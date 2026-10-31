import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('choice elements', () => {
  it('rejects two types of the same choice', () => {
    const text =
      '{\n  "resourceType": "Patient",\n  "deceasedBoolean": true,\n  "deceasedDateTime": "2020"\n}';
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message:
          'Only one type of deceased[x] is allowed, but both "deceasedBoolean" and "deceasedDateTime" are present.',
        path: 'Patient.deceasedDateTime',
        line: 4,
        column: 3,
      },
    ]);
  });

  it('rejects a type the choice does not allow', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "deceasedString": "x"\n}')).toEqual([
      {
        severity: 'error',
        message:
          '"deceasedString" is not an allowed type for deceased[x]. Allowed: deceasedBoolean, deceasedDateTime.',
        path: 'Patient.deceasedString',
        line: 3,
        column: 3,
      },
    ]);
  });

  it('rejects the literal [x] name', () => {
    expect(validate('{"resourceType": "Patient", "deceased[x]": true}')[0]?.path).toBe(
      'Patient.deceased[x]',
    );
  });

  it('validates the value against the chosen type', () => {
    const text = '{\n  "resourceType": "Patient",\n  "deceasedDateTime": "yesterday"\n}';
    expect(validate(text)[0]).toMatchObject({
      path: 'Patient.deceasedDateTime',
      line: 3,
      message: expect.stringContaining('is not a valid dateTime'),
    });
  });

  it('requires a mandatory choice', () => {
    const text = '{\n  "resourceType": "Provenance",\n  "recorded": "2020-01-01T10:00:00Z"\n}';
    const paths = validate(text).map((issue) => issue.path);
    expect(paths).toContain('Provenance.target');
  });

  it('reports a missing mandatory choice by its [x] name', () => {
    const text = '{"resourceType": "MedicationAdministration", "status": "completed"}';
    const paths = validate(text).map((issue) => issue.path);
    expect(paths).toContain('MedicationAdministration.medication[x]');
  });
});
