import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('codes with a required binding', () => {
  it('rejects a code outside the value set', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "gender": "Male"\n}')).toEqual([
      {
        severity: 'error',
        message: '"Male" is not an allowed code. Allowed: male, female, other, unknown.',
        path: 'Patient.gender',
        line: 3,
        column: 13,
      },
    ]);
  });

  it('rejects a CodeableConcept when no coding is in the value set', () => {
    const text = `{
  "resourceType": "Condition",
  "subject": { "reference": "Patient/1" },
  "clinicalStatus": {
    "coding": [{ "system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "nope" }]
  }
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message:
          '"nope" from http://terminology.hl7.org/CodeSystem/condition-clinical is not an allowed code. Allowed: active, recurrence, relapse, inactive, remission, resolved.',
        path: 'Condition.clinicalStatus',
        line: 4,
        column: 21,
      },
    ]);
  });

  it('accepts a CodeableConcept when one coding is in the value set', () => {
    const text = `{
  "resourceType": "Condition",
  "subject": { "reference": "Patient/1" },
  "clinicalStatus": {
    "coding": [
      { "system": "http://x.org", "code": "other" },
      { "system": "http://terminology.hl7.org/CodeSystem/condition-clinical", "code": "active" }
    ]
  }
}`;
    expect(validate(text)).toEqual([]);
  });

  it('skips value sets the spec does not fully list', () => {
    const text = '{"resourceType": "Binary", "contentType": "made-up/type", "data": "QUJD"}';
    expect(validate(text)).toEqual([]);
  });

  it('skips extensible, preferred and example bindings', () => {
    const text = `{
  "resourceType": "Patient",
  "maritalStatus": { "coding": [{ "system": "http://x.org", "code": "anything" }] }
}`;
    expect(validate(text)).toEqual([]);
  });

  it.each([
    ['only text', '{ "text": "active" }'],
    ['a code with no system', '{ "coding": [{ "code": "active" }] }'],
    ['a system with no code', '{ "coding": [{ "system": "http://x.org" }] }'],
  ])('rejects a required CodeableConcept with %s', (_label, concept) => {
    const text = `{
  "resourceType": "Condition",
  "subject": { "reference": "Patient/1" },
  "clinicalStatus": ${concept}
}`;
    expect(validate(text).filter((issue) => issue.severity === 'error')).toEqual([
      {
        severity: 'error',
        message:
          'A code is required here, with both a system and a code. Allowed: active, recurrence, relapse, inactive, remission, resolved.',
        path: 'Condition.clinicalStatus',
        line: 4,
        column: 21,
      },
    ]);
  });

  it('rejects a required code that has only an extension', () => {
    const text = `{
  "resourceType": "Patient",
  "_gender": { "id": "a" }
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message:
          'A code is required here, but there is only an extension. Allowed: male, female, other, unknown.',
        path: 'Patient._gender',
        line: 3,
        column: 14,
      },
    ]);
  });

  it('accepts a code from another FHIR version carried in a cross-version extension', () => {
    const text = JSON.stringify({
      resourceType: 'Patient',
      _gender: {
        extension: [
          {
            url: 'http://hl7.org/fhir/5.0/StructureDefinition/extension-Patient.gender',
            valueCode: 'x',
          },
        ],
      },
    });
    expect(validate(text)).toEqual([]);
  });

  it('does not repeat itself for an empty required CodeableConcept', () => {
    const text =
      '{"resourceType": "Condition", "subject": {"reference": "P/1"}, "clinicalStatus": {}}';
    expect(validate(text).map((issue) => issue.message)).toEqual([
      'Empty objects are not allowed.',
    ]);
  });
});
