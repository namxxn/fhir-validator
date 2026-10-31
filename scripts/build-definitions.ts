import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { unzipSync, strFromU8 } from 'fflate';

const SOURCE_URL = 'https://hl7.org/fhir/R4/definitions.json.zip';
// R4 is frozen, so a change here means the download is not the file these definitions came from.
const SOURCE_SHA256 = 'ecd74b1d57d86869992b4171e490d1a3fcebb8877110756b73f7be0f7159f534';
const OUTPUT_URL = new URL('../src/definitions/r4.json', import.meta.url);
const FHIR_TYPE_EXTENSION = 'http://hl7.org/fhir/StructureDefinition/structuredefinition-fhir-type';
const REGEX_EXTENSION = 'http://hl7.org/fhir/StructureDefinition/regex';
const JSON_NUMBER_PRIMITIVES = new Set(['decimal', 'integer', 'positiveInt', 'unsignedInt']);

interface FhirExtension {
  url: string;
  valueUrl?: string;
  valueString?: string;
}

interface FhirElementType {
  code: string;
  extension?: FhirExtension[];
}

interface FhirElement {
  path: string;
  min?: number;
  max?: string;
  type?: FhirElementType[];
  contentReference?: string;
  binding?: { strength: string; valueSet?: string };
}

interface StructureDefinition {
  resourceType: 'StructureDefinition';
  name: string;
  kind: string;
  abstract: boolean;
  derivation?: string;
  snapshot: { element: FhirElement[] };
}

interface CodeSystemConcept {
  code: string;
  concept?: CodeSystemConcept[];
}

interface CodeSystem {
  resourceType: 'CodeSystem';
  url: string;
  content: string;
  concept?: CodeSystemConcept[];
}

interface ValueSetInclude {
  system?: string;
  concept?: { code: string }[];
  filter?: unknown[];
  valueSet?: string[];
}

interface ValueSet {
  resourceType: 'ValueSet';
  url: string;
  compose?: { include: ValueSetInclude[]; exclude?: unknown[] };
}

interface Bundle<T> {
  entry: { resource: T | { resourceType: string } }[];
}

interface OutputElement {
  min?: number;
  array?: true;
  types?: string[];
  ref?: string;
  codes?: number;
  children?: Record<string, OutputElement>;
}

interface OutputCodes {
  system: string;
  codes: string[];
}

async function downloadSources(): Promise<Record<string, Uint8Array>> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Could not download ${SOURCE_URL}: ${response.status}`);
  }
  const archive = new Uint8Array(await response.arrayBuffer());
  const digest = createHash('sha256').update(archive).digest('hex');
  if (digest !== SOURCE_SHA256) {
    throw new Error(`${SOURCE_URL} has checksum ${digest}, expected ${SOURCE_SHA256}`);
  }
  return unzipSync(archive);
}

function readBundle<T>(files: Record<string, Uint8Array>, name: string): T[] {
  const file = files[name];
  if (!file) {
    throw new Error(`${name} is missing from ${SOURCE_URL}`);
  }
  const bundle = JSON.parse(strFromU8(file)) as Bundle<T>;
  return bundle.entry.map((entry) => entry.resource as T);
}

function isStructureDefinition(resource: unknown): resource is StructureDefinition {
  return (resource as StructureDefinition).resourceType === 'StructureDefinition';
}

/**
 * The spec's regexes are written for Java, where \s and \S mean ASCII whitespace only. In
 * JavaScript they also cover Unicode spaces, which would reject a legal non-breaking space inside
 * a string, so the meaning has to be spelled out rather than copied.
 */
function toJavaScriptRegex(source: string): string {
  const asciiSpace = ' \\t\\n\\x0B\\f\\r';
  const unicodeSpace = '\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF';
  let result = '';
  let inClass = false;
  for (let index = 0; index < source.length; index++) {
    const pair = source.slice(index, index + 2);
    if (pair === '\\s') {
      result += inClass ? asciiSpace : `[${asciiSpace}]`;
      index++;
    } else if (pair === '\\S') {
      result += inClass ? `\\S${unicodeSpace}` : `[\\S${unicodeSpace}]`;
      index++;
    } else if (source[index] === '\\') {
      result += pair;
      index++;
    } else {
      if (source[index] === '[') inClass = true;
      if (source[index] === ']') inClass = false;
      result += source[index];
    }
  }
  return result;
}

function fhirTypeCode(type: FhirElementType): string {
  if (!type.code.startsWith('http://hl7.org/fhirpath/')) {
    return type.code;
  }
  const declared = type.extension?.find((extension) => extension.url === FHIR_TYPE_EXTENSION);
  if (!declared?.valueUrl) {
    throw new Error(`No FHIR type declared for ${type.code}`);
  }
  return declared.valueUrl;
}

/**
 * The R4 files declare every resource's top-level id as a plain string, but the published spec
 * and the official validator treat it as the `id` type. Taking the files literally would mean the
 * id format is never checked.
 */
function elementTypes(element: FhirElement, isResource: boolean): string[] {
  const parts = element.path.split('.');
  if (isResource && parts.length === 2 && parts[1] === 'id') {
    return ['id'];
  }
  return (element.type ?? []).map(fhirTypeCode);
}

function collectConcepts(concepts: CodeSystemConcept[] | undefined, into: string[]): string[] {
  for (const concept of concepts ?? []) {
    into.push(concept.code);
    collectConcepts(concept.concept, into);
  }
  return into;
}

/** Returns null when the spec does not fully list the codes, so the element goes unchecked. */
function listValueSetCodes(
  valueSet: ValueSet | undefined,
  codeSystems: Map<string, CodeSystem>,
): OutputCodes[] | null {
  if (!valueSet?.compose || valueSet.compose.exclude) {
    return null;
  }
  const lists: OutputCodes[] = [];
  for (const include of valueSet.compose.include) {
    if (include.filter || include.valueSet || !include.system) {
      return null;
    }
    if (include.concept) {
      lists.push({ system: include.system, codes: include.concept.map(({ code }) => code) });
      continue;
    }
    const codeSystem = codeSystems.get(include.system);
    if (codeSystem?.content !== 'complete') {
      return null;
    }
    lists.push({ system: include.system, codes: collectConcepts(codeSystem.concept, []) });
  }
  return lists;
}

class BindingTable {
  readonly tables: OutputCodes[][] = [];
  private readonly indexByUrl = new Map<string, number | null>();
  private readonly valueSets: Map<string, ValueSet>;
  private readonly codeSystems: Map<string, CodeSystem>;

  constructor(valueSets: Map<string, ValueSet>, codeSystems: Map<string, CodeSystem>) {
    this.valueSets = valueSets;
    this.codeSystems = codeSystems;
  }

  indexOf(url: string): number | null {
    const known = this.indexByUrl.get(url);
    if (known !== undefined) {
      return known;
    }
    const canonical = url.split('|')[0] ?? url;
    const codes = listValueSetCodes(this.valueSets.get(canonical), this.codeSystems);
    const index = codes ? this.tables.push(codes) - 1 : null;
    this.indexByUrl.set(url, index);
    return index;
  }
}

function toOutputElement(
  element: FhirElement,
  isResource: boolean,
  bindings: BindingTable,
): OutputElement {
  const output: OutputElement = {};
  if (element.min) output.min = element.min;
  if (element.max !== '1' && element.max !== '0') output.array = true;
  if (element.contentReference) {
    output.ref = element.contentReference.replace(/^#/, '');
    return output;
  }
  const types = elementTypes(element, isResource);
  if (types.length) output.types = types;
  if (element.binding?.strength === 'required' && element.binding.valueSet) {
    const index = bindings.indexOf(element.binding.valueSet);
    if (index !== null) output.codes = index;
  }
  return output;
}

function buildStructure(
  definition: StructureDefinition,
  bindings: BindingTable,
): Record<string, OutputElement> {
  const isResource = definition.kind === 'resource';
  const [rootElement, ...elements] = definition.snapshot.element;
  const nodes = new Map<string, OutputElement>();
  const root: OutputElement = {};
  nodes.set(rootElement?.path ?? definition.name, root);
  for (const element of elements) {
    const parentPath = element.path.slice(0, element.path.lastIndexOf('.'));
    const name = element.path.slice(element.path.lastIndexOf('.') + 1);
    const parent = nodes.get(parentPath);
    if (!parent) {
      throw new Error(`${element.path} has no parent element`);
    }
    if (element.max === '0') continue;
    const node = toOutputElement(element, isResource, bindings);
    (parent.children ??= {})[name] = node;
    nodes.set(element.path, node);
  }
  return root.children ?? {};
}

function buildPrimitive(definition: StructureDefinition): { json: string; regex?: string } {
  const value = definition.snapshot.element.find((element) => element.path.endsWith('.value'));
  const regex = value?.type
    ?.flatMap((type) => type.extension ?? [])
    .find((extension) => extension.url === REGEX_EXTENSION)?.valueString;
  let json = 'string';
  if (definition.name === 'boolean') json = 'boolean';
  if (JSON_NUMBER_PRIMITIVES.has(definition.name)) json = 'number';
  return regex ? { json, regex: toJavaScriptRegex(regex) } : { json };
}

function assertKnownTypes(
  structures: Record<string, Record<string, OutputElement>>,
  primitives: Record<string, unknown>,
): void {
  const known = (code: string): boolean =>
    code === 'Resource' || code in structures || code in primitives;
  const visit = (children: Record<string, OutputElement>, path: string): void => {
    for (const [name, element] of Object.entries(children)) {
      for (const code of element.types ?? []) {
        if (!known(code) && !element.children) {
          throw new Error(`${path}.${name} uses unknown type ${code}`);
        }
      }
      if (element.children) visit(element.children, `${path}.${name}`);
    }
  };
  for (const [name, children] of Object.entries(structures)) visit(children, name);
}

async function main(): Promise<void> {
  const files = await downloadSources();
  const definitions = [
    ...readBundle<unknown>(files, 'profiles-types.json'),
    ...readBundle<unknown>(files, 'profiles-resources.json'),
  ].filter(isStructureDefinition);

  const valueSets = new Map<string, ValueSet>();
  const codeSystems = new Map<string, CodeSystem>();
  for (const resource of readBundle<ValueSet | CodeSystem>(files, 'valuesets.json')) {
    if (resource.resourceType === 'ValueSet') valueSets.set(resource.url, resource);
    if (resource.resourceType === 'CodeSystem') codeSystems.set(resource.url, resource);
  }

  const bindings = new BindingTable(valueSets, codeSystems);
  const primitives: Record<string, { json: string; regex?: string }> = {};
  const structures: Record<string, Record<string, OutputElement>> = {};
  const resourceTypes: string[] = [];

  for (const definition of definitions) {
    if (definition.kind === 'primitive-type') {
      primitives[definition.name] = buildPrimitive(definition);
    } else if (definition.kind === 'complex-type' || definition.kind === 'resource') {
      structures[definition.name] = buildStructure(definition, bindings);
      if (definition.kind === 'resource' && !definition.abstract) {
        resourceTypes.push(definition.name);
      }
    }
  }
  assertKnownTypes(structures, primitives);

  const output = {
    version: '4.0.1',
    resourceTypes,
    primitives,
    structures,
    valueSets: bindings.tables,
  };
  writeFileSync(OUTPUT_URL, `${JSON.stringify(output)}\n`);
}

await main();
