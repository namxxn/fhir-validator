import type { CodeList } from './types';

const MAX_CODES_SHOWN = 8;

export function describeAllowedCodes(lists: CodeList[]): string {
  const codes = lists.flatMap((list) => list.codes);
  const shown = codes.slice(0, MAX_CODES_SHOWN).join(', ');
  const remaining = codes.length - MAX_CODES_SHOWN;
  return remaining > 0 ? `${shown} and ${remaining} more` : shown;
}

export function includesCode(lists: CodeList[], code: string): boolean {
  return lists.some((list) => list.codes.includes(code));
}

export function includesCoding(lists: CodeList[], system: string, code: string): boolean {
  return lists.some((list) => list.system === system && list.codes.includes(code));
}
