import r4 from '../definitions/r4.json';
import { findMember, isStackOverflow, parseJson, stringValue } from './json';
import { report, validateResource } from './resource';
import type { Context } from './resource';
import type { Definitions, Issue } from './types';

export type { Issue, Severity } from './types';
export { formatJson } from './format';

const definitions = r4 as Definitions;

function byPosition(a: Issue, b: Issue): number {
  return a.line - b.line || a.column - b.column;
}

function singleError(message: string, line = 1, column = 1): Issue[] {
  return [{ severity: 'error', message, path: '', line, column }];
}

export function declaredResourceType(text: string): string | undefined {
  const parsed = parseJson(text);
  if ('problem' in parsed || parsed.document.body.type !== 'Object') return undefined;
  return stringValue(findMember(parsed.document.body, 'resourceType')?.value);
}

export function validate(text: string): Issue[] {
  if (!text.trim()) {
    return singleError('The document is empty.');
  }
  try {
    const parsed = parseJson(text);
    if ('problem' in parsed) {
      const { message, line, column } = parsed.problem;
      return singleError(message, line, column);
    }
    const root = parsed.document.body;
    const context: Context = { text, definitions, issues: [] };
    if (root.type === 'Object') {
      validateResource(context, root, '');
    } else {
      report(context, root, 'error', '', 'A resource must be a JSON object.');
    }
    return context.issues.sort(byPosition);
  } catch (error) {
    // Extreme nesting exhausts the call stack; that must not take the page down with it.
    if (isStackOverflow(error)) {
      return singleError('This document is nested too deeply to check.');
    }
    throw error;
  }
}
