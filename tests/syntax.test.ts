import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';
import { isStackOverflow } from '../src/validator/json';

describe('JSON syntax', () => {
  it('reports the line and column of a syntax error', () => {
    expect(validate('{\n  "resourceType": "Patient",\n  "active" true\n}')).toEqual([
      {
        severity: 'error',
        message: expect.stringContaining('Invalid JSON'),
        path: '',
        line: 3,
        column: 12,
      },
    ]);
  });

  it('ignores a byte order mark, and keeps positions exact', () => {
    expect(validate('\ufeff{"resourceType": "Patient", "xyzzy": 1}')).toEqual([
      {
        severity: 'error',
        message: 'Unknown element "xyzzy".',
        path: 'Patient.xyzzy',
        line: 1,
        column: 30,
      },
    ]);
  });

  it('reports a trailing comma', () => {
    const [issue] = validate('{\n  "resourceType": "Patient",\n}');
    expect(issue).toMatchObject({ severity: 'error', path: '', line: 3, column: 1 });
  });

  it('reports truncated input', () => {
    const [issue] = validate('{"resourceType": "Patient"');
    expect(issue?.message).toContain('Invalid JSON');
    expect(issue?.line).toBe(1);
  });

  it('reports an empty document', () => {
    expect(validate('  \n ')).toEqual([
      { severity: 'error', message: 'The document is empty.', path: '', line: 1, column: 1 },
    ]);
  });

  it('survives extreme nesting', () => {
    const issues = validate('['.repeat(200000));
    expect(issues[0]?.severity).toBe('error');
  });

  it('recognises how each browser reports a call stack that ran out', () => {
    const firefoxError = Object.assign(new Error('too much recursion'), { name: 'InternalError' });
    expect(isStackOverflow(new RangeError('Maximum call stack size exceeded'))).toBe(true);
    expect(isStackOverflow(firefoxError)).toBe(true);
    expect(isStackOverflow(new TypeError('other'))).toBe(false);
  });
});
