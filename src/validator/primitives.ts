import { abbreviate } from './text';
import type { PrimitiveDefinition } from './types';

const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const INTEGER_TYPES = new Set(['integer', 'positiveInt', 'unsignedInt']);
const CALENDAR_TYPES = new Set(['date', 'dateTime', 'instant']);
const ASCII_WHITESPACE = /[ \t\n\v\f\r]+/g;
const BASE64 = /^[0-9a-zA-Z+/]+={0,2}$/;
const URN_FORMATS: [string, string][] = [
  ['urn:oid:', 'oid'],
  ['urn:uuid:', 'uuid'],
];
const URI_TYPES = new Set(['uri', 'url', 'canonical']);

const FORMAT_HINTS: Record<string, string> = {
  base64Binary: 'Expected base64-encoded data.',
  code: 'Expected text with no leading, trailing or repeated spaces.',
  date: 'Expected YYYY, YYYY-MM or YYYY-MM-DD.',
  dateTime: 'Expected YYYY, YYYY-MM, YYYY-MM-DD, or a full date and time with a time zone.',
  id: 'Expected 1 to 64 letters, digits, hyphens or dots.',
  instant: 'Expected a full date and time with a time zone, such as 2026-01-31T09:30:00Z.',
  oid: 'Expected a value such as urn:oid:1.2.3.',
  positiveInt: 'Expected a whole number of 1 or more.',
  time: 'Expected HH:MM:SS.',
  unsignedInt: 'Expected a whole number of 0 or more.',
  uuid: 'Expected a lowercase value such as urn:uuid:c757873d-ec9a-4326-a141-556f43239520.',
};

const compiledRegexes = new Map<string, RegExp>();

function compile(source: string): RegExp {
  let regex = compiledRegexes.get(source);
  if (!regex) {
    regex = new RegExp(`^(?:${source})$`);
    compiledRegexes.set(source, regex);
  }
  return regex;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isRealCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) {
    return true;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return day <= daysInMonth(year, month);
}

/**
 * Replaces the spec's base64Binary regex, which repeats a group per four characters and so overflows
 * the regex engine on a large attachment, failing a perfectly valid file. It also accepts "=" in the
 * middle of the data, which cannot be decoded and which the official validator rejects.
 */
function isBase64(value: string): boolean {
  const compact = value.replace(ASCII_WHITESPACE, '');
  return compact.length % 4 === 0 && BASE64.test(compact);
}

function describeFormatProblem(type: string, value: string): string {
  const hint = FORMAT_HINTS[type];
  return `"${abbreviate(value)}" is not a valid ${type}.${hint ? ` ${hint}` : ''}`;
}

/** The official validator holds these URIs to the oid and uuid formats, not just to "no spaces". */
function findUrnProblem(
  primitives: Record<string, PrimitiveDefinition>,
  value: string,
): string | undefined {
  const urn = value.split(/[|#]/)[0] ?? value;
  for (const [prefix, type] of URN_FORMATS) {
    const regex = primitives[type]?.regex;
    if (urn.startsWith(prefix) && regex && !compile(regex).test(urn)) {
      return describeFormatProblem(type, value);
    }
  }
  return undefined;
}

/**
 * Checks a value's text against its type. Numbers arrive as written in the document, because
 * parsing them first would hide forms like 1.0 for an integer.
 */
export function findFormatProblem(
  type: string,
  primitives: Record<string, PrimitiveDefinition>,
  value: string,
): string | undefined {
  const definition = primitives[type];
  const matches =
    type === 'base64Binary'
      ? isBase64(value)
      : !definition?.regex || compile(definition.regex).test(value);
  if (!matches) {
    return describeFormatProblem(type, value);
  }
  // trim() also covers Unicode spaces, which the code regex lets through but the official validator
  // rejects at either end of a code.
  if (type === 'code' && value !== value.trim()) {
    return describeFormatProblem(type, value);
  }
  if (URI_TYPES.has(type)) {
    return findUrnProblem(primitives, value);
  }
  if (CALENDAR_TYPES.has(type) && !isRealCalendarDate(value)) {
    return `"${value}" is not a real calendar date.`;
  }
  if (INTEGER_TYPES.has(type)) {
    const number = Number(value);
    if (number < INT32_MIN || number > INT32_MAX) {
      return `${value} is too large for ${type}, which is limited to 32 bits.`;
    }
  }
  return undefined;
}
