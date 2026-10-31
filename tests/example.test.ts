import { describe, expect, it } from 'vitest';
import { EXAMPLE_RESOURCE } from '../src/ui/example';
import { validate } from '../src/validator';

describe('the Load example resource', () => {
  it('shows one of each deliberate mistake', () => {
    expect(
      validate(EXAMPLE_RESOURCE).map(({ severity, path, line }) => [severity, path, line]),
    ).toEqual([
      ['error', 'Patient.active', 4],
      ['error', 'Patient.gender', 12],
      ['error', 'Patient.birthdate', 13],
      ['error', 'Patient.deceasedDateTime', 14],
      ['warning', 'Patient.maritalStatus.coding[0]', 18],
    ]);
  });
});
