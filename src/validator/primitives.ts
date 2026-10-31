import type { PrimitiveDefinition } from './types';

const MAX_VALUE_SHOWN = 80;
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;
const INTEGER_TYPES = new Set(['integer', 'positiveInt', 'unsignedInt']);
const CALENDAR_TYPES = new Set(['date', 'dateTime', 'instant']);
const ASCII_WHITESPACE = /[ \t\n\v\f\r]+/g;
const BASE64_CHARACTERS = /^[0-9a-zA-Z+/=]+$/;

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
 * Means the same as the spec's base64Binary regex. That regex repeats a group per four characters,
 * which overflows the regex engine on a large attachment and would fail a perfectly valid file.
 */
function isBase64(value: string): boolean {
  const compact = value.replace(ASCII_WHITESPACE, '');
  return compact.length % 4 === 0 && BASE64_CHARACTERS.test(compact);
}

/** A rejected attachment can be megabytes long, and quoting it whole would bury the message. */
function abbreviate(value: string): string {
  return value.length > MAX_VALUE_SHOWN ? `${value.slice(0, MAX_VALUE_SHOWN)}…` : value;
}

function describeFormatProblem(type: string, value: string): string {
  const hint = FORMAT_HINTS[type];
  return `"${abbreviate(value)}" is not a valid ${type}.${hint ? ` ${hint}` : ''}`;
}

/**
 * Checks a value's text against its type. Numbers arrive as written in the document, because
 * parsing them first would hide forms like 1.0 for an integer.
 */
export function findFormatProblem(
  type: string,
  definition: PrimitiveDefinition,
  value: string,
): string | undefined {
  const matches =
    type === 'base64Binary'
      ? isBase64(value)
      : !definition.regex || compile(definition.regex).test(value);
  if (!matches) {
    return describeFormatProblem(type, value);
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
