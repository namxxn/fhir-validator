import { describe, expect, it } from 'vitest';
import { validate } from '../src/validator';

function patientWith(element: string, json: string): string {
  return `{\n  "resourceType": "Patient",\n  "${element}": ${json}\n}`;
}

describe('primitive formats', () => {
  it.each([
    ['id', '"has spaces"', '"has spaces" is not a valid id.'],
    ['id', `"${'a'.repeat(65)}"`, 'is not a valid id.'],
    ['birthDate', '"01/02/2000"', '"01/02/2000" is not a valid date.'],
    ['birthDate', '"2000-13-01"', '"2000-13-01" is not a valid date.'],
    ['birthDate', '"2026-02-30"', '"2026-02-30" is not a real calendar date.'],
    ['birthDate', '"2023-02-29"', '"2023-02-29" is not a real calendar date.'],
    ['birthDate', '20000101', 'Expected text in quotes, not a number.'],
    ['deceasedDateTime', '"2020-01-01T10:00:00"', 'is not a valid dateTime.'],
    ['deceasedDateTime', '"2026-04-31T10:00:00Z"', 'is not a real calendar date.'],
    ['deceasedBoolean', '"true"', 'Expected true or false, not text in quotes.'],
    ['active', '1', 'Expected true or false, not a number.'],
    ['multipleBirthInteger', '1.5', '"1.5" is not a valid integer.'],
    ['multipleBirthInteger', '1.0', '"1.0" is not a valid integer.'],
    ['multipleBirthInteger', '"2"', 'Expected a number, not text in quotes.'],
    ['multipleBirthInteger', '2147483648', 'too large for integer'],
    ['implicitRules', '"has space"', '"has space" is not a valid uri.'],
    ['language', '"has  two  spaces"', 'is not a valid code.'],
    ['language', '"en\u00a0"', 'is not a valid code.'],
  ])('rejects %s = %s', (element, json, expected) => {
    const issues = validate(patientWith(element, json));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', path: `Patient.${element}`, line: 3 });
    expect(issues[0]?.message).toContain(expected);
  });

  it('checks instant', () => {
    const text = '{"resourceType": "Patient", "meta": {"lastUpdated": "2020-01-01"}}';
    expect(validate(text)[0]).toMatchObject({
      path: 'Patient.meta.lastUpdated',
      message: expect.stringContaining('is not a valid instant'),
    });
  });

  it('checks base64Binary', () => {
    const text = '{"resourceType": "Binary", "contentType": "text/plain", "data": "@@@@"}';
    expect(validate(text)[0]?.path).toBe('Binary.data');
  });

  it.each(['QQ==QUJD', '=QQ=', 'Q===', 'QUJ'])('rejects badly padded base64 %s', (data) => {
    const text = `{"resourceType": "Binary", "contentType": "a/b", "data": "${data}"}`;
    expect(validate(text)[0]?.message).toContain('is not a valid base64Binary');
  });

  it.each(['QUJD', 'QQ==', 'QUI=', 'QU JD\\nQUJD'])('accepts base64 %s', (data) => {
    const text = `{"resourceType": "Binary", "contentType": "a/b", "data": "${data}"}`;
    expect(validate(text)).toEqual([]);
  });

  it.each([
    ['urn:oid:9.9', 'is not a valid oid'],
    ['urn:uuid:C757873D-EC9A-4326-A141-556F43239520', 'is not a valid uuid'],
  ])('holds the uri %s to its own format', (system, expected) => {
    const text = `{"resourceType": "Patient", "identifier": [{"system": "${system}"}]}`;
    expect(validate(text)[0]).toMatchObject({
      path: 'Patient.identifier[0].system',
      message: expect.stringContaining(expected),
    });
  });

  it.each([
    'urn:oid:1.2.3',
    'urn:uuid:c757873d-ec9a-4326-a141-556f43239520',
    'urn:uuid:c757873d-ec9a-4326-a141-556f43239520|1.0',
    'urn:other:THING',
  ])('accepts the uri %s', (system) => {
    const text = `{"resourceType": "Patient", "identifier": [{"system": "${system}"}]}`;
    expect(validate(text)).toEqual([]);
  });

  it('checks positiveInt', () => {
    const text =
      '{"resourceType": "Patient", "contact": [{"period": {"start": "2020"}}], "photo": [{"size": -1}]}';
    expect(validate(text)[0]).toMatchObject({
      path: 'Patient.photo[0].size',
      message: expect.stringContaining('is not a valid unsignedInt'),
    });
  });

  it.each([
    ['birthDate', '"2024-02-29"'],
    ['birthDate', '"2000"'],
    ['birthDate', '"2000-07"'],
    ['deceasedDateTime', '"2016-12-31T23:59:60Z"'],
    ['deceasedDateTime', '"2020-01-01T10:00:00.123+05:30"'],
    ['multipleBirthInteger', '-1'],
    ['multipleBirthInteger', '2147483647'],
    ['language', '"en-US"'],
  ])('accepts %s = %s', (element, json) => {
    expect(validate(patientWith(element, json))).toEqual([]);
  });

  it('accepts decimals in every legal form', () => {
    for (const value of ['1', '1.10', '-0.5', '1e3', '1.5E-2']) {
      const text = `{"resourceType": "Observation", "status": "final", "code": {"text": "x"}, "valueQuantity": {"value": ${value}, "unit": "mg"}}`;
      expect(validate(text)).toEqual([]);
    }
  });

  it('accepts very long strings and codes without failing', () => {
    const family = 'a '.repeat(1_000_000);
    const name = `{"resourceType": "Patient", "name": [{"family": "${family}x"}]}`;
    expect(validate(name)).toEqual([]);
    const coded = `{"resourceType": "Binary", "contentType": "${family}x"}`;
    expect(validate(coded)).toEqual([]);
  });

  it('accepts non-breaking spaces in strings, as the Java-flavoured spec regexes do', () => {
    const text = '{"resourceType": "Patient", "name": [{"family": "Smith Jones"}]}';
    expect(validate(text)).toEqual([]);
  });

  it('shortens a long rejected value in the message', () => {
    const text = `{"resourceType": "Binary", "contentType": "a/b", "data": "${'@'.repeat(1000)}"}`;
    expect(validate(text)[0]?.message.length).toBeLessThan(200);
  });

  it('checks very large base64 values without failing', () => {
    const data = 'QUJD'.repeat(2_000_000);
    const text = `{"resourceType": "Binary", "contentType": "text/plain", "data": "${data}"}`;
    expect(validate(text)).toEqual([]);
  });
});
