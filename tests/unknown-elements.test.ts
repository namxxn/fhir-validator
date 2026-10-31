import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('unknown elements', () => {
  it('suggests the near match', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "birthdate": "2000-01-01"\n}')).toEqual([
      {
        severity: 'error',
        message: 'Unknown element "birthdate". Did you mean "birthDate"?',
        path: 'Patient.birthdate',
        line: 3,
        column: 3,
      },
    ]);
  });

  it('gives no suggestion when nothing is close', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "xyzzy": 1\n}')).toEqual([
      {
        severity: 'error',
        message: 'Unknown element "xyzzy".',
        path: 'Patient.xyzzy',
        line: 3,
        column: 3,
      },
    ]);
  });

  it('finds unknown elements inside complex types', () => {
    const text = '{\n  "resourceType": "Patient",\n  "name": [\n    { "familly": "Doe" }\n  ]\n}';
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message: 'Unknown element "familly". Did you mean "family"?',
        path: 'Patient.name[0].familly',
        line: 4,
        column: 7,
      },
    ]);
  });

  it.each(['constructor', '__proto__', 'toString'])('treats %s as an ordinary name', (name) => {
    expect(validate(`{"resourceType": "Patient", "${name}": 1}`)[0]?.message).toContain(
      `Unknown element "${name}"`,
    );
  });

  it('copes with a very long unknown name', () => {
    const name = 'a'.repeat(1_000_000);
    expect(validate(`{"resourceType": "Patient", "${name}": 1}`)).toHaveLength(1);
  });

  it('rejects a duplicated element', () => {
    expect(
      validate('{\n  "resourceType": "Patient",\n  "active": true,\n  "active": false\n}'),
    ).toEqual([
      {
        severity: 'error',
        message: 'Duplicate element "active".',
        path: 'Patient.active',
        line: 4,
        column: 3,
      },
    ]);
  });
});
