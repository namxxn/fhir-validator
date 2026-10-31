import { parse } from '@humanwhocodes/momoa';
import type { DocumentNode, MemberNode, ObjectNode, ValueNode } from '@humanwhocodes/momoa';

export type {
  ArrayNode,
  DocumentNode,
  MemberNode,
  ObjectNode,
  ValueNode,
} from '@humanwhocodes/momoa';

interface SyntaxProblem {
  message: string;
  line: number;
  column: number;
}

export type ParseResult = { document: DocumentNode } | { problem: SyntaxProblem };

function hasLocation(error: unknown): error is Error & { line: number; column: number } {
  return error instanceof Error && 'line' in error && 'column' in error;
}

export function parseJson(text: string): ParseResult {
  try {
    return { document: parse(text, { mode: 'json' }) };
  } catch (error) {
    if (!hasLocation(error)) {
      throw error;
    }
    return {
      problem: {
        message: `Invalid JSON: ${error.message.replace(/ \(\d+:\d+\)$/, '')}`,
        line: error.line,
        column: error.column,
      },
    };
  }
}

export function memberName(member: MemberNode): string {
  return member.name.type === 'String' ? member.name.value : member.name.name;
}

export function findMember(node: ObjectNode, name: string): MemberNode | undefined {
  return node.members.find((member) => memberName(member) === name);
}

export function stringValue(node: ValueNode | undefined): string | undefined {
  return node?.type === 'String' ? node.value : undefined;
}

export function sourceText(text: string, node: ValueNode): string {
  return text.slice(node.loc.start.offset, node.loc.end.offset);
}
