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

type ParseResult = { document: DocumentNode } | { problem: SyntaxProblem };

function hasLocation(error: unknown): error is Error & { line: number; column: number } {
  return error instanceof Error && 'line' in error && 'column' in error;
}

export function parseJson(text: string): ParseResult {
  try {
    // A byte order mark is legal to ignore. A space takes its place so positions stay exact.
    return { document: parse(text.replace(/^\uFEFF/, ' '), { mode: 'json' }) };
  } catch (error) {
    // Safari puts a line and column on its stack overflow error too.
    if (!hasLocation(error) || isStackOverflow(error)) {
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

/** Browsers disagree on what they throw when the call stack runs out: Firefox has its own error. */
export function isStackOverflow(error: unknown): boolean {
  return error instanceof RangeError || (error instanceof Error && error.name === 'InternalError');
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
