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

  it('accepts a required CodeableConcept that has only text', () => {
    const text =
      '{"resourceType": "AllergyIntolerance", "patient": {"reference": "Patient/1"}, "clinicalStatus": {"text": "active"}}';
    expect(validate(text)).toEqual([]);
  });
});
