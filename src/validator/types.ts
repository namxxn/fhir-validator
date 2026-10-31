export type Severity = 'error' | 'warning';

export interface Issue {
  severity: Severity;
  message: string;
  path: string;
  line: number;
  column: number;
}

export interface ElementDefinition {
  min?: number;
  array?: true;
  types?: string[];
  /** Path of another element whose shape this one reuses, such as Questionnaire.item. */
  ref?: string;
  /** Index into Definitions.valueSets. */
  codes?: number;
  children?: Structure;
}

export type Structure = Record<string, ElementDefinition>;

export interface PrimitiveDefinition {
  json: string;
  regex?: string;
}

export interface CodeList {
  system: string;
  codes: string[];
}

export interface Definitions {
  version: string;
  resourceTypes: string[];
  primitives: Record<string, PrimitiveDefinition>;
  structures: Record<string, Structure>;
  valueSets: CodeList[][];
}
