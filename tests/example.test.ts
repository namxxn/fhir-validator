import { describe, expect, it } from 'vitest';
import { EXAMPLE_RESOURCE } from '../src/ui/example';
import { validate } from '../src/validator';

describe('the Load example resource', () => {
  it('is valid, with no errors or warnings', () => {
    expect(validate(EXAMPLE_RESOURCE)).toEqual([]);
  });
});
