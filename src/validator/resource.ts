import { describeAllowedCodes, includesCode, includesCoding } from './bindings';
import { findMember, memberName, sourceText, stringValue } from './json';
import type { MemberNode, ObjectNode, ValueNode } from './json';
import { findFormatProblem } from './primitives';
import { closestName } from './suggest';
import type { Definitions, ElementDefinition, Issue, Severity, Structure } from './types';

const CHOICE_SUFFIX = '[x]';
const EXTENSION_PREFIX = '_';
const MAX_CHOICES_SHOWN = 8;
const QUANTITY_TYPES = new Set(['Quantity', 'Age', 'Count', 'Distance', 'Duration']);

export interface Context {
  text: string;
  definitions: Definitions;
  issues: Issue[];
}

interface ResolvedElement {
  key: string;
  definition: ElementDefinition;
  type: string | undefined;
}

interface ElementGroup {
  name: string;
  resolved: ResolvedElement;
  value?: MemberNode;
  extension?: MemberNode;
}

export function report(
  context: Context,
  node: ValueNode | MemberNode['name'] | ObjectNode,
  severity: Severity,
  path: string,
  message: string,
): void {
  const { line, column } = node.loc.start;
  context.issues.push({ severity, message, path, line, column });
}

function reportError(
  context: Context,
  node: ValueNode | MemberNode['name'],
  path: string,
  message: string,
): void {
  report(context, node, 'error', path, message);
}

function isChoiceKey(key: string): boolean {
  return key.endsWith(CHOICE_SUFFIX);
}

function choiceBase(key: string): string {
  return key.slice(0, -CHOICE_SUFFIX.length);
}

function choiceNames(key: string, definition: ElementDefinition): string[] {
  const base = choiceBase(key);
  return (definition.types ?? []).map(
    (type) => `${base}${type.charAt(0).toUpperCase()}${type.slice(1)}`,
  );
}

function ownElement(structure: Structure, name: string): ElementDefinition | undefined {
  return Object.hasOwn(structure, name) ? structure[name] : undefined;
}

function resolveElement(structure: Structure, name: string): ResolvedElement | undefined {
  const direct = isChoiceKey(name) ? undefined : ownElement(structure, name);
  if (direct) {
    return { key: name, definition: direct, type: direct.types?.[0] };
  }
  for (const [key, definition] of Object.entries(structure)) {
    if (!isChoiceKey(key)) continue;
    const index = choiceNames(key, definition).indexOf(name);
    if (index >= 0) {
      return { key, definition, type: definition.types?.[index] };
    }
  }
  return undefined;
}

function knownNames(structure: Structure): string[] {
  return Object.entries(structure).flatMap(([key, definition]) =>
    isChoiceKey(key) ? choiceNames(key, definition) : [key],
  );
}

function listChoices(names: string[]): string {
  const shown = names.slice(0, MAX_CHOICES_SHOWN).join(', ');
  const remaining = names.length - MAX_CHOICES_SHOWN;
  return remaining > 0 ? `${shown} and ${remaining} more` : shown;
}

function findChoiceKey(structure: Structure, name: string): string | undefined {
  return Object.keys(structure).find((key) => {
    if (!isChoiceKey(key)) return false;
    const base = choiceBase(key);
    return name.startsWith(base) && /^[A-Z]/.test(name.slice(base.length));
  });
}

function reportUnknownElement(
  context: Context,
  member: MemberNode,
  rawName: string,
  structure: Structure,
  path: string,
): void {
  const name = rawName.startsWith(EXTENSION_PREFIX) ? rawName.slice(1) : rawName;
  const choiceKey = findChoiceKey(structure, name);
  const choice = choiceKey ? structure[choiceKey] : undefined;
  if (choiceKey && choice) {
    reportError(
      context,
      member.name,
      `${path}.${rawName}`,
      `"${rawName}" is not an allowed type for ${choiceKey}. Allowed: ${listChoices(choiceNames(choiceKey, choice))}.`,
    );
    return;
  }
  const suggestion = closestName(name, knownNames(structure));
  const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
  reportError(context, member.name, `${path}.${rawName}`, `Unknown element "${rawName}".${hint}`);
}

function groupMembers(
  context: Context,
  node: ObjectNode,
  structure: Structure,
  path: string,
  isResource: boolean,
): Map<string, ElementGroup> {
  const groups = new Map<string, ElementGroup>();
  const seen = new Set<string>();
  for (const member of node.members) {
    const rawName = memberName(member);
    if (seen.has(rawName)) {
      reportError(context, member.name, `${path}.${rawName}`, `Duplicate element "${rawName}".`);
      continue;
    }
    seen.add(rawName);
    if (isResource && rawName === 'resourceType') continue;

    const isExtension = rawName.startsWith(EXTENSION_PREFIX);
    const name = isExtension ? rawName.slice(1) : rawName;
    const resolved = resolveElement(structure, name);
    if (!resolved) {
      reportUnknownElement(context, member, rawName, structure, path);
      continue;
    }
    if (isExtension && !isPrimitiveType(context, resolved.type)) {
      reportError(
        context,
        member.name,
        `${path}.${rawName}`,
        `"${rawName}" is not allowed, because "${name}" is not a primitive value.`,
      );
      continue;
    }
    const group = groupFor(context, groups, name, resolved, member, path);
    if (isExtension) group.extension = member;
    else group.value = member;
  }
  return groups;
}

/** Choice elements share a group key, which is how a second type of the same choice is caught. */
function groupFor(
  context: Context,
  groups: Map<string, ElementGroup>,
  name: string,
  resolved: ResolvedElement,
  member: MemberNode,
  path: string,
): ElementGroup {
  const existing = groups.get(resolved.key);
  if (existing && existing.name === name) {
    return existing;
  }
  if (existing) {
    reportError(
      context,
      member.name,
      `${path}.${memberName(member)}`,
      `Only one type of ${resolved.key} is allowed, but both "${existing.name}" and "${name}" are present.`,
    );
    return { name, resolved };
  }
  const group: ElementGroup = { name, resolved };
  groups.set(resolved.key, group);
  return group;
}

function isPrimitiveType(context: Context, type: string | undefined): boolean {
  return type !== undefined && Object.hasOwn(context.definitions.primitives, type);
}

function checkRequired(
  context: Context,
  node: ObjectNode,
  structure: Structure,
  groups: Map<string, ElementGroup>,
  path: string,
): void {
  for (const [key, definition] of Object.entries(structure)) {
    if (definition.min && !groups.has(key)) {
      reportError(context, node, `${path}.${key}`, `Missing required element "${key}".`);
    }
  }
}

function validateMembers(
  context: Context,
  node: ObjectNode,
  structure: Structure,
  path: string,
  isResource: boolean,
): void {
  const groups = groupMembers(context, node, structure, path, isResource);
  for (const group of groups.values()) {
    validateGroup(context, group, path);
  }
  checkRequired(context, node, structure, groups, path);
}

function itemsOf(member: MemberNode | undefined): (ValueNode | undefined)[] {
  if (!member) return [];
  return member.value.type === 'Array'
    ? member.value.elements.map((element) => element.value)
    : [member.value];
}

function checkArrayShape(
  context: Context,
  member: MemberNode,
  definition: ElementDefinition,
  path: string,
): boolean {
  const node = member.value;
  const name = memberName(member);
  if (node.type === 'Array' && !node.elements.length) {
    reportError(context, node, path, `"${name}" is an empty array, which is not allowed.`);
    return false;
  }
  if (definition.array && node.type !== 'Array' && node.type !== 'Null') {
    reportError(context, node, path, `"${name}" must be an array, even with a single value.`);
  }
  if (!definition.array && node.type === 'Array') {
    reportError(context, node, path, `"${name}" must be a single value, not an array.`);
  }
  return true;
}

function validateGroup(context: Context, group: ElementGroup, parentPath: string): void {
  const { name, resolved, value, extension } = group;
  const valuePath = `${parentPath}.${name}`;
  const extensionPath = `${parentPath}.${EXTENSION_PREFIX}${name}`;
  const valueOk = !value || checkArrayShape(context, value, resolved.definition, valuePath);
  const extensionOk =
    !extension || checkArrayShape(context, extension, resolved.definition, extensionPath);
  if (!valueOk || !extensionOk) return;

  const values = itemsOf(value);
  const extensions = itemsOf(extension);
  const count = Math.max(values.length, extensions.length);
  for (let index = 0; index < count; index++) {
    validateItem(context, resolved, {
      value: values[index],
      extension: extensions[index],
      valuePath: value?.value.type === 'Array' ? `${valuePath}[${index}]` : valuePath,
      extensionPath:
        extension?.value.type === 'Array' ? `${extensionPath}[${index}]` : extensionPath,
      inArray: value?.value.type === 'Array' || extension?.value.type === 'Array',
    });
  }
}

interface ItemPair {
  value: ValueNode | undefined;
  extension: ValueNode | undefined;
  valuePath: string;
  extensionPath: string;
  inArray: boolean;
}

/**
 * Inside arrays of primitives, FHIR uses null as a placeholder that keeps a value lined up with
 * its "_name" partner, so null is only wrong there when neither side has anything at that index.
 */
function validateItem(context: Context, resolved: ResolvedElement, item: ItemPair): void {
  const { value, extension, valuePath, extensionPath, inArray } = item;
  const valueIsNull = value?.type === 'Null';
  const extensionIsNull = extension?.type === 'Null';
  const placeholdersAllowed = inArray && isPrimitiveType(context, resolved.type);

  if (value && (!valueIsNull || !placeholdersAllowed || !extension || extensionIsNull)) {
    validateValue(context, value, resolved, valuePath);
  }
  if (!extension) return;
  if (extensionIsNull) {
    if (!placeholdersAllowed || !value || valueIsNull) {
      reportError(context, extension, extensionPath, 'null is not allowed here.');
    }
    return;
  }
  if (extension.type !== 'Object') {
    reportError(context, extension, extensionPath, 'Expected an object with id or extension.');
    return;
  }
  validateObject(
    context,
    extension,
    context.definitions.structures['Element'] ?? {},
    extensionPath,
  );
}

function validateObject(
  context: Context,
  node: ObjectNode,
  structure: Structure,
  path: string,
): void {
  if (!node.members.length) {
    reportError(context, node, path, 'Empty objects are not allowed.');
    return;
  }
  validateMembers(context, node, structure, path, false);
}

function resolveReference(definitions: Definitions, ref: string): ElementDefinition | undefined {
  const [root, ...rest] = ref.split('.');
  let structure = root ? definitions.structures[root] : undefined;
  let element: ElementDefinition | undefined;
  for (const part of rest) {
    element = structure?.[part];
    structure = element?.children;
  }
  return element;
}

function structureFor(
  definitions: Definitions,
  { definition, type }: ResolvedElement,
): Structure | undefined {
  const target = definition.ref ? resolveReference(definitions, definition.ref) : definition;
  if (target?.children) return target.children;
  return type && Object.hasOwn(definitions.structures, type)
    ? definitions.structures[type]
    : undefined;
}

function validateValue(
  context: Context,
  node: ValueNode,
  resolved: ResolvedElement,
  path: string,
): void {
  if (node.type === 'Null') {
    reportError(context, node, path, 'null is not allowed. Leave the element out instead.');
    return;
  }
  const { type } = resolved;
  if (type === 'Resource') {
    validateNestedResource(context, node, path);
  } else if (isPrimitiveType(context, type)) {
    validatePrimitive(context, node, resolved, path);
  } else {
    validateComplex(context, node, resolved, path);
  }
}

function validateNestedResource(context: Context, node: ValueNode, path: string): void {
  if (node.type !== 'Object') {
    reportError(context, node, path, 'Expected a resource (a JSON object).');
    return;
  }
  if (!node.members.length) {
    reportError(context, node, path, 'Empty objects are not allowed.');
    return;
  }
  validateResource(context, node, path);
}

function validateComplex(
  context: Context,
  node: ValueNode,
  resolved: ResolvedElement,
  path: string,
): void {
  const structure = structureFor(context.definitions, resolved);
  if (!structure) return;
  if (node.type !== 'Object') {
    const label = resolved.type && resolved.type !== 'BackboneElement' ? ` (${resolved.type})` : '';
    reportError(context, node, path, `Expected an object${label}.`);
    return;
  }
  validateObject(context, node, structure, path);
  checkCodedObject(context, node, resolved, path);
  checkAdvisories(context, node, resolved.type, path);
}

const JSON_TYPE_NAMES: Record<string, string> = {
  Array: 'an array',
  Boolean: 'true or false',
  Number: 'a number',
  Object: 'an object',
  String: 'text in quotes',
};

function validatePrimitive(
  context: Context,
  node: ValueNode,
  resolved: ResolvedElement,
  path: string,
): void {
  const type = resolved.type ?? '';
  const definition = context.definitions.primitives[type];
  if (!definition) return;

  const expected =
    definition.json === 'boolean' ? 'Boolean' : definition.json === 'number' ? 'Number' : 'String';
  if (node.type !== expected) {
    const actual = JSON_TYPE_NAMES[node.type] ?? 'something else';
    reportError(context, node, path, `Expected ${JSON_TYPE_NAMES[expected]}, not ${actual}.`);
    return;
  }
  if (node.type === 'String' && node.value === '') {
    reportError(context, node, path, 'Empty strings are not allowed.');
    return;
  }
  const value = node.type === 'String' ? node.value : sourceText(context.text, node);
  const problem = findFormatProblem(type, definition, value);
  if (problem) {
    reportError(context, node, path, problem);
    return;
  }
  checkCode(context, node, resolved, value, path);
}

function codeListsFor(context: Context, definition: ElementDefinition) {
  return definition.codes === undefined
    ? undefined
    : context.definitions.valueSets[definition.codes];
}

function checkCode(
  context: Context,
  node: ValueNode,
  { definition }: ResolvedElement,
  code: string,
  path: string,
): void {
  const lists = codeListsFor(context, definition);
  if (lists && !includesCode(lists, code)) {
    reportError(
      context,
      node,
      path,
      `"${code}" is not an allowed code. Allowed: ${describeAllowedCodes(lists)}.`,
    );
  }
}

function checkCodedObject(
  context: Context,
  node: ObjectNode,
  { definition, type }: ResolvedElement,
  path: string,
): void {
  const lists = codeListsFor(context, definition);
  if (!lists) return;
  const codings = type === 'Coding' ? [node] : type === 'CodeableConcept' ? codingsOf(node) : [];
  const complete = codings.flatMap((coding) => {
    const system = stringValue(findMember(coding, 'system')?.value);
    const code = stringValue(findMember(coding, 'code')?.value);
    return system !== undefined && code !== undefined ? [{ system, code }] : [];
  });
  // A coding with no system or code cannot be judged here; other checks and warnings cover it.
  if (
    !complete.length ||
    complete.some(({ system, code }) => includesCoding(lists, system, code))
  ) {
    return;
  }
  const first = complete[0];
  reportError(
    context,
    node,
    path,
    `"${first?.code}" from ${first?.system} is not an allowed code. Allowed: ${describeAllowedCodes(lists)}.`,
  );
}

function codingsOf(node: ObjectNode): ObjectNode[] {
  return itemsOf(findMember(node, 'coding')).filter(
    (item): item is ObjectNode => item?.type === 'Object',
  );
}

function checkAdvisories(
  context: Context,
  node: ObjectNode,
  type: string | undefined,
  path: string,
): void {
  if (type === 'Coding') {
    const code = findMember(node, 'code');
    if (code && !findMember(node, 'system')) {
      report(
        context,
        code.name,
        'warning',
        path,
        'This code has no system, so nothing says which code system it belongs to.',
      );
    }
  }
  if (type && QUANTITY_TYPES.has(type)) {
    const value = findMember(node, 'value');
    if (value && !findMember(node, 'unit') && !findMember(node, 'code')) {
      report(
        context,
        value.name,
        'warning',
        path,
        'This value has no unit or code, so nothing says what it measures.',
      );
    }
  }
}

export function validateResource(context: Context, node: ObjectNode, path: string): void {
  const { definitions } = context;
  const typePath = path ? `${path}.resourceType` : 'resourceType';
  const member = findMember(node, 'resourceType');
  if (!member) {
    reportError(context, node, typePath, 'Missing "resourceType".');
    return;
  }
  const type = stringValue(member.value);
  if (type === undefined) {
    reportError(context, member.value, typePath, '"resourceType" must be a string.');
    return;
  }
  const structure = definitions.resourceTypes.includes(type)
    ? definitions.structures[type]
    : undefined;
  if (!structure) {
    const suggestion = closestName(type, definitions.resourceTypes);
    const hint = suggestion ? ` Did you mean "${suggestion}"?` : '';
    reportError(context, member.value, typePath, `"${type}" is not an R4 resource type.${hint}`);
    return;
  }
  validateMembers(context, node, structure, path || type, true);
}
