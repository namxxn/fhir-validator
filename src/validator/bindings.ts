import { summarizeList } from './text';
import type { CodeList } from './types';

export function describeAllowedCodes(lists: CodeList[]): string {
  return summarizeList(lists.flatMap((list) => list.codes));
}

export function includesCode(lists: CodeList[], code: string): boolean {
  return lists.some((list) => list.codes.includes(code));
}

export function includesCoding(lists: CodeList[], system: string, code: string): boolean {
  return lists.some((list) => list.system === system && list.codes.includes(code));
}
