# FHIR Validator

A free, browser-based validator for HL7® FHIR® R4 (4.0.1) resources in JSON, from Medblocks. Paste
or open a resource, choose Validate, and get a list of problems with the element path and line
number. Nothing leaves the browser: the page's content security policy forbids all outbound
connections.

It does not check FHIRPath invariants, terminology, profiles, XML or R5. For full conformance
checks, use the [official HL7® validator](https://validator.fhir.org/).

## Run it locally

Requires Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Then open <http://localhost:5173/tools/fhir-validator/>.

## Test

```sh
npm test
npm run lint
```

`npm test` runs a test file per check, plus all 2,911 official R4 examples from
`tests/fixtures/examples-json.zip`, so it needs no internet.

### Official examples that break HL7®'s own definitions

2,712 examples validate with zero errors. The other 199 break rules in the R4 definition files, so
the validator reports them. They are recorded in `tests/fixtures/known-hl7-faults.json`, and the
tests fail if a finding changes or disappears.

| Examples | Fault in the example                                | Rule                                |
| -------- | --------------------------------------------------- | ----------------------------------- |
| 188      | `*-questionnaire.json` items have no `linkId`       | `Questionnaire.item.linkId` is 1..1 |
| 10       | `SearchParameter` extension examples have no `base` | `SearchParameter.base` is 1..\*     |
| 1        | A `SearchParameter` id has 67 characters            | The `id` type allows 64             |

`package-min-ver.json` in the same archive is build information rather than a resource, so it is
not validated.

## Build

```sh
npm run build
```

The static site is written to `dist/`, configured for the base path `/tools/fhir-validator/`.

## Regenerate the definitions

`src/definitions/r4.json` is generated from HL7®'s official definition files and committed, so
building needs no internet. Regenerating does, because it downloads them again:

```sh
npm run definitions
```

To support R5 later, generate a second data file with the same script against the R5 files.

## Deploy

Publish the contents of `dist/` so that they are served at
`https://medblocks.com/tools/fhir-validator/`. Add them alongside the existing site, and do not
replace or remove anything outside that path.

Browsers ignore `frame-ancestors` when it is set in the page, so if the host adds response headers,
add this one for the path, as HL7 Studio has:

```
Content-Security-Policy: frame-ancestors 'none'
```
