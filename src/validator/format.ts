import { isStackOverflow, memberName, parseJson, sourceText } from './json';
import type { ValueNode } from './json';

const INDENT = '  ';

function print(node: ValueNode, text: string, indent: string): string {
  const inner = indent + INDENT;
  if (node.type === 'Object' && node.members.length) {
    const members = node.members.map(
      (member) =>
        `${inner}${JSON.stringify(memberName(member))}: ${print(member.value, text, inner)}`,
    );
    return `{\n${members.join(',\n')}\n${indent}}`;
  }
  if (node.type === 'Array' && node.elements.length) {
    const elements = node.elements.map((element) => `${inner}${print(element.value, text, inner)}`);
    return `[\n${elements.join(',\n')}\n${indent}]`;
  }
  return sourceText(text, node);
}

/**
 * Reprints from the source text rather than through JSON.parse, which would silently rewrite
 * decimals such as 1.10 (their precision is meaningful in FHIR) and drop duplicate keys.
 * Returns null when the text is not valid JSON or is nested too deeply to walk.
 */
export function formatJson(text: string): string | null {
  try {
    const result = parseJson(text);
    return 'document' in result ? `${print(result.document.body, text, '')}\n` : null;
  } catch (error) {
    if (isStackOverflow(error)) return null;
    throw error;
  }
}
