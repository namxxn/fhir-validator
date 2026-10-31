import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('warnings', () => {
  it('warns about a Coding with a code but no system', () => {
    const text = `{
  "resourceType": "Patient",
  "maritalStatus": {
    "coding": [
      {
        "code": "M"
      }
    ]
  }
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'warning',
        message: 'This code has no system, so nothing says which code system it belongs to.',
        path: 'Patient.maritalStatus.coding[0]',
        line: 6,
        column: 9,
      },
    ]);
  });

  it('warns about a Quantity with a value but no unit or code', () => {
    const text = `{
  "resourceType": "Observation",
  "status": "final",
  "code": { "text": "x" },
  "valueQuantity": {
    "value": 3
  }
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'warning',
        message: 'This value has no unit or code, so nothing says what it measures.',
        path: 'Observation.valueQuantity',
        line: 6,
        column: 5,
      },
    ]);
  });

  it('stays quiet when the unit or code is there', () => {
    const quantity = (body: string) =>
      `{"resourceType": "Observation", "status": "final", "code": {"text": "x"}, "valueQuantity": ${body}}`;
    expect(validate(quantity('{"value": 3, "unit": "mg"}'))).toEqual([]);
    expect(validate(quantity('{"value": 3, "code": "mg"}'))).toEqual([]);
  });
});
