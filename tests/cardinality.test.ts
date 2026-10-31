import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('cardinality', () => {
  it('requires mandatory elements, reported on the containing object', () => {
    expect(validate('{\n  "resourceType": "Observation",\n  "status": "final"\n}')).toEqual([
      {
        severity: 'error',
        message: 'Missing required element "code".',
        path: 'Observation.code',
        line: 1,
        column: 1,
      },
    ]);
  });

  it('requires mandatory elements in nested parts', () => {
    const text = '{\n  "resourceType": "Patient",\n  "link": [\n    { "type": "seealso" }\n  ]\n}';
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message: 'Missing required element "other".',
        path: 'Patient.link[0].other',
        line: 4,
        column: 5,
      },
    ]);
  });

  it('requires an array where the spec allows many', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "name": { "family": "Doe" }\n}')).toEqual([
      {
        severity: 'error',
        message: '"name" must be an array, even with a single value.',
        path: 'Patient.name',
        line: 3,
        column: 11,
      },
    ]);
  });

  it('rejects an array where the spec allows one', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "active": [true]\n}')).toEqual([
      {
        severity: 'error',
        message: '"active" must be a single value, not an array.',
        path: 'Patient.active',
        line: 3,
        column: 13,
      },
    ]);
  });

  it('accepts a required element that only has a primitive extension', () => {
    const text = JSON.stringify({
      resourceType: 'Questionnaire',
      status: 'draft',
      item: [
        {
          _linkId: {
            extension: [
              {
                url: 'http://hl7.org/fhir/StructureDefinition/data-absent-reason',
                valueCode: 'unknown',
              },
            ],
          },
          type: 'group',
        },
      ],
    });
    expect(validate(text)).toEqual([]);
  });
});
