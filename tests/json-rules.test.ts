import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

function patient(body: string): string {
  return `{\n  "resourceType": "Patient",\n  ${body}\n}`;
}

describe('FHIR JSON rules', () => {
  it('rejects null', () => {
    expect(validate(patient('"active": null'))).toEqual([
      {
        severity: 'error',
        message: 'null is not allowed. Leave the element out instead.',
        path: 'Patient.active',
        line: 3,
        column: 13,
      },
    ]);
  });

  it('rejects an empty object', () => {
    expect(validate(patient('"maritalStatus": {}'))).toEqual([
      {
        severity: 'error',
        message: 'Empty objects are not allowed.',
        path: 'Patient.maritalStatus',
        line: 3,
        column: 20,
      },
    ]);
  });

  it('rejects an empty array', () => {
    expect(validate(patient('"name": []'))).toEqual([
      {
        severity: 'error',
        message: '"name" is an empty array, which is not allowed.',
        path: 'Patient.name',
        line: 3,
        column: 11,
      },
    ]);
  });

  it('rejects an empty string', () => {
    expect(validate(patient('"birthDate": ""'))).toEqual([
      {
        severity: 'error',
        message: 'Empty strings are not allowed.',
        path: 'Patient.birthDate',
        line: 3,
        column: 16,
      },
    ]);
  });

  it('rejects null inside an array of complex values', () => {
    expect(validate(patient('"name": [null]'))[0]?.path).toBe('Patient.name[0]');
  });

  it('accepts a primitive extension', () => {
    const body =
      '"birthDate": "2000-01-01", "_birthDate": {"extension": [{"url": "http://x.org", "valueTime": "10:00:00"}]}';
    expect(validate(patient(body))).toEqual([]);
  });

  it('accepts a primitive extension with no value', () => {
    expect(validate(patient('"_birthDate": {"id": "a"}'))).toEqual([]);
  });

  it('checks inside a primitive extension', () => {
    const body = '"_birthDate": {"extension": [{"url": "http://x.org", "valueDate": "nope"}]}';
    expect(validate(patient(body))).toEqual([
      expect.objectContaining({
        path: 'Patient._birthDate.extension[0].valueDate',
        line: 3,
      }),
    ]);
  });

  it('rejects "_name" on an element that is not a primitive', () => {
    expect(validate(patient('"_maritalStatus": {"id": "a"}'))).toEqual([
      {
        severity: 'error',
        message:
          '"_maritalStatus" is not allowed, because "maritalStatus" is not a primitive value.',
        path: 'Patient._maritalStatus',
        line: 3,
        column: 3,
      },
    ]);
  });

  it('rejects an unknown "_name"', () => {
    expect(validate(patient('"_nothing": {"id": "a"}'))[0]?.path).toBe('Patient._nothing');
  });

  it('rejects a "_name" that is not an object', () => {
    expect(validate(patient('"birthDate": "2000", "_birthDate": "x"'))[0]?.path).toBe(
      'Patient._birthDate',
    );
  });

  it('rejects an empty "_name"', () => {
    expect(validate(patient('"_birthDate": {}'))[0]?.message).toBe(
      'Empty objects are not allowed.',
    );
  });

  it('allows null as a placeholder that lines up arrays of primitives', () => {
    const body = `"name": [{
    "given": ["A", null],
    "_given": [null, {"id": "b"}]
  }]`;
    expect(validate(patient(body))).toEqual([]);
  });

  it('rejects a placeholder with nothing to line up with', () => {
    const body = '"name": [{"given": ["A", null]}]';
    expect(validate(patient(body))).toEqual([
      expect.objectContaining({ path: 'Patient.name[0].given[1]', line: 3 }),
    ]);
  });

  it('rejects null on both sides at the same index', () => {
    const body = '"name": [{"given": ["A", null], "_given": [{"id": "a"}, null]}]';
    expect(validate(patient(body)).map((issue) => issue.path)).toContain(
      'Patient.name[0].given[1]',
    );
  });
});
