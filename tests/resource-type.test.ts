import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

describe('resourceType', () => {
  it('rejects a document that is not an object', () => {
    expect(validate('\n[1, 2]')).toEqual([
      {
        severity: 'error',
        message: 'A resource must be a JSON object.',
        path: '',
        line: 2,
        column: 1,
      },
    ]);
  });

  it('requires resourceType', () => {
    expect(validate('{\n  "id": "a"\n}')).toEqual([
      {
        severity: 'error',
        message: 'Missing "resourceType".',
        path: 'resourceType',
        line: 1,
        column: 1,
      },
    ]);
  });

  it('rejects a type that does not exist, and suggests the near match', () => {
    expect(validate('{\n  "resourceType": "Patiant"\n}')).toEqual([
      {
        severity: 'error',
        message: '"Patiant" is not an R4 resource type. Did you mean "Patient"?',
        path: 'resourceType',
        line: 2,
        column: 19,
      },
    ]);
  });

  it('rejects abstract types', () => {
    expect(validate('{"resourceType": "DomainResource"}')[0]?.message).toContain(
      'is not an R4 resource type',
    );
  });

  it('rejects a type name inherited from JavaScript objects', () => {
    expect(validate('{"resourceType": "constructor"}')[0]?.message).toContain(
      'is not an R4 resource type',
    );
  });

  it('requires a string', () => {
    expect(validate('{"resourceType": 3}')[0]).toMatchObject({
      message: '"resourceType" must be a string.',
      path: 'resourceType',
    });
  });
});
