import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('data types', () => {
  it('rejects a primitive where a complex type belongs', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "maritalStatus": "M"\n}')).toEqual([
      {
        severity: 'error',
        message: 'Expected an object (CodeableConcept).',
        path: 'Patient.maritalStatus',
        line: 3,
        column: 20,
      },
    ]);
  });

  it('rejects an object where a primitive belongs', () => {
    const text =
      '{\n  "resourceType": "Patient",\n  "name": [\n    { "family": { "x": 1 } }\n  ]\n}';
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message: 'Expected text in quotes, not an object.',
        path: 'Patient.name[0].family',
        line: 4,
        column: 17,
      },
    ]);
  });

  it('checks through several levels of complex types', () => {
    const text = `{
  "resourceType": "Patient",
  "identifier": [
    {
      "type": { "coding": [{ "system": "http://x.org", "display": 1 }] },
      "assigner": { "reference": true }
    }
  ]
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message: 'Expected text in quotes, not a number.',
        path: 'Patient.identifier[0].type.coding[0].display',
        line: 5,
        column: 67,
      },
      {
        severity: 'error',
        message: 'Expected text in quotes, not true or false.',
        path: 'Patient.identifier[0].assigner.reference',
        line: 6,
        column: 34,
      },
    ]);
  });

  it('follows elements that reuse another element, such as Questionnaire.item.item', () => {
    const text = JSON.stringify(
      {
        resourceType: 'Questionnaire',
        status: 'draft',
        item: [{ linkId: '1', type: 'group', item: [{ linkId: '2', type: 'nope' }] }],
      },
      null,
      1,
    );
    const [issue] = validate(text);
    expect(issue?.path).toBe('Questionnaire.item[0].item[0].type');
    expect(issue?.message).toContain('"nope" is not an allowed code');
  });
});
