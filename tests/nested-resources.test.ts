import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('nested resources', () => {
  it('validates contained resources', () => {
    const text = `{
  "resourceType": "Patient",
  "contained": [
    { "resourceType": "Organization", "id": "o", "nam": "Acme" }
  ]
}`;
    expect(validate(text)).toEqual([
      {
        severity: 'error',
        message: 'Unknown element "nam". Did you mean "name"?',
        path: 'Patient.contained[0].nam',
        line: 4,
        column: 50,
      },
    ]);
  });

  it('validates Bundle.entry.resource', () => {
    const text = `{
  "resourceType": "Bundle",
  "type": "collection",
  "entry": [
    { "resource": { "resourceType": "Patient", "gender": "x" } }
  ]
}`;
    expect(validate(text)).toEqual([
      expect.objectContaining({
        severity: 'error',
        path: 'Bundle.entry[0].resource.gender',
        line: 5,
        column: 58,
      }),
    ]);
  });

  it('validates any other element of type Resource', () => {
    const text = `{
  "resourceType": "Parameters",
  "parameter": [
    { "name": "p", "resource": { "resourceType": "Patient", "birthDate": "x" } }
  ]
}`;
    expect(validate(text)[0]?.path).toBe('Parameters.parameter[0].resource.birthDate');
  });

  it('follows bundles inside bundles', () => {
    const inner = {
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ resource: { resourceType: 'Basic' } }],
    };
    const text = JSON.stringify({
      resourceType: 'Bundle',
      type: 'collection',
      entry: [{ resource: inner }],
    });
    expect(validate(text)[0]?.path).toBe('Bundle.entry[0].resource.entry[0].resource.code');
  });

  it('requires a nested resource to state its type', () => {
    const text = '{"resourceType": "Patient", "contained": [{"id": "a"}]}';
    expect(validate(text)).toEqual([
      expect.objectContaining({
        message: 'Missing "resourceType".',
        path: 'Patient.contained[0].resourceType',
      }),
    ]);
  });

  it('rejects an unknown nested type', () => {
    const text = '{"resourceType": "Patient", "contained": [{"resourceType": "Nope"}]}';
    expect(validate(text)[0]?.path).toBe('Patient.contained[0].resourceType');
  });

  it('rejects a nested resource that is not an object', () => {
    const text = '{"resourceType": "Patient", "contained": ["x"]}';
    expect(validate(text)[0]).toMatchObject({
      path: 'Patient.contained[0]',
      message: 'Expected a resource (a JSON object).',
    });
  });

  it('rejects an empty nested resource', () => {
    const text = '{"resourceType": "Patient", "contained": [{}]}';
    expect(validate(text)[0]?.message).toBe('Empty objects are not allowed.');
  });
});
