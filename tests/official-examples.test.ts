import { readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';
import knownFaults from './fixtures/known-hl7-faults.json';

interface KnownFault {
  errors: number;
  messages: string[];
}

const NOT_A_RESOURCE = 'package-min-ver.json';
const faults: Record<string, KnownFault> = knownFaults;

const archive = unzipSync(readFileSync(new URL('./fixtures/examples-json.zip', import.meta.url)));
const examples = Object.keys(archive).filter(
  (name) => name.endsWith('.json') && name !== NOT_A_RESOURCE,
);
const clean = examples.filter((name) => !(name in faults));

function errorsFor(name: string) {
  const text = strFromU8(archive[name] as Uint8Array);
  return validate(text).filter((issue) => issue.severity === 'error');
}

describe('official R4 examples', () => {
  it('covers the whole archive', () => {
    expect(examples.length).toBe(2911);
  });

  it.each(clean)('%s has no errors', (name) => {
    expect(errorsFor(name)).toEqual([]);
  });
});

/**
 * These examples break rules stated in HL7's own definitions, and the README explains each one.
 * They are pinned rather than skipped, so a change that hides or alters the finding fails here.
 */
describe('official R4 examples that break the R4 definitions', () => {
  it.each(Object.keys(faults))('%s is reported exactly as recorded', (name) => {
    const fault = faults[name] as KnownFault;
    const errors = errorsFor(name);
    expect(errors).toHaveLength(fault.errors);
    expect(new Set(errors.map((issue) => issue.message))).toEqual(new Set(fault.messages));
  });
});
