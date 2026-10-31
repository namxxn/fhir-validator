import { describe, expect, it } from 'vitest';
import { formatJson } from '../src/validator';

describe('formatJson', () => {
  it('indents with two spaces', () => {
    expect(formatJson('{"a":[1,{"b":"c"}],"d":{},"e":[]}')).toBe(
      '{\n  "a": [\n    1,\n    {\n      "b": "c"\n    }\n  ],\n  "d": {},\n  "e": []\n}\n',
    );
  });

  it('keeps decimals exactly as written', () => {
    expect(formatJson('{"value":1.10,"big":12345678901234567890}')).toBe(
      '{\n  "value": 1.10,\n  "big": 12345678901234567890\n}\n',
    );
  });

  it('keeps duplicate keys, so the validator can still report them', () => {
    expect(formatJson('{"a":1,"a":2}')).toBe('{\n  "a": 1,\n  "a": 2\n}\n');
  });

  it('keeps escapes in strings', () => {
    expect(formatJson('{"a":"\\u00e9\\n"}')).toBe('{\n  "a": "\\u00e9\\n"\n}\n');
  });

  it('returns null for invalid JSON', () => {
    expect(formatJson('{')).toBeNull();
  });
});
