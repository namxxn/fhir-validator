# FHIR Validator

A free browser tool from Medblocks that checks HL7® FHIR® R4 (4.0.1) resources in JSON. Paste or
open a resource and choose Validate. The tool lists each problem with its element path and line
number.

Validation runs in the browser. The page's content security policy blocks all outbound connections,
so a resource cannot leave the device.

The tool does not check FHIRPath invariants, terminology, profiles, XML or R5. For those checks, use
the [official HL7® validator](https://validator.fhir.org/).

## Run it

You need Node.js 22.18 or newer.

```sh
npm install
npm run dev
```

Open <http://localhost:5173/tools/fhir-validator/>.

## Project layout

| Path               | Contents                                                |
| ------------------ | ------------------------------------------------------- |
| `scripts/`         | Script that generates the definitions                   |
| `src/definitions/` | Generated R4 data                                       |
| `src/validator/`   | Validation logic with no browser code: `validate(text)` |
| `src/ui/`          | Editor, results and theme                               |
| `how-to-use/`      | The How to use page                                     |
| `tests/`           | One test file per check, and the official examples      |

## Test

```sh
npm test
npm run lint
```

The tests need no internet. `tests/fixtures/examples-json.zip` holds all 2,911 official R4 examples.
The archive also holds `package-min-ver.json`, which is build information and not a resource, so the
tests skip it.

### Official examples with errors

2,708 examples pass with zero errors. The other 203 break the R4 rules, and the validator reports
them. `tests/fixtures/known-hl7-faults.json` records each finding, so a test fails if a finding
changes or disappears.

| Examples | Fault                                                                           | Rule                                |
| -------- | ------------------------------------------------------------------------------- | ----------------------------------- |
| 188      | `*-questionnaire.json` items have no `linkId`                                   | `Questionnaire.item.linkId` is 1..1 |
| 10       | `SearchParameter` examples have no `base`                                       | `SearchParameter.base` is 1..\*     |
| 2        | `CapabilityStatement` and `TerminologyCapabilities` URLs have an uppercase uuid | A uuid must be lowercase            |
| 1        | A `SearchParameter` id has 67 characters                                        | An `id` has at most 64 characters   |
| 1        | A `Library` value set is the placeholder `urn:oid:X.Y.Z`                        | The value is not a valid oid        |
| 1        | `v2-tables.json` has codes that end in a non-breaking space                     | A code cannot end in a space        |

## Comparison with the official validator

We compared results with HL7®'s official validator (`validator_cli` 7.0.3) on one occasion. This is
not an automated test, and the repository does not include the official validator.

| Input                  | Compared | Same verdict | We report errors, official does not | Official reports errors, we do not |
| ---------------------- | -------- | ------------ | ----------------------------------- | ---------------------------------- |
| Official R4 examples   | 2,908    | 2,600        | 0                                   | 308                                |
| HL7® shared test suite | 215      | 144          | 3                                   | 68                                 |
| Edge cases we wrote    | 124      | 113          | 6                                   | 5                                  |

The official validator failed with an internal error on three other examples, so those three have no
comparison.

Where only the official validator reports errors, the errors we reviewed come from checks this tool does not do. Examples are invariants, extension lookups, profile rules and absolute canonical URLs. We reviewed the error types in that group, not each error.

The three test suite cases in the fourth column use special settings. Two allow comments in JSON,
and one skips contained resources.

We are stricter than the official validator in two places, and the R4 rules support both:

- We reject abstract types such as `DomainResource` as a `resourceType`.
- We reject malformed base64 in `Binary.data`. The official validator rejects the same values in an
  `Attachment`.

## Build

```sh
npm run build
```

The build writes a static site to `dist/`, with the base path `/tools/fhir-validator/`.

## Regenerate the definitions

The build reads `src/definitions/r4.json` and needs no internet. Only regeneration needs internet,
because the script downloads HL7®'s definition files and checks their SHA-256 checksum.

```sh
npm run definitions
```

To add R5 later, generate a second data file with the same script.

## Deploy

Publish the contents of `dist/` at `https://medblocks.com/tools/fhir-validator/`. Add the files next
to the existing site. Do not replace or remove anything outside that path.

Browsers ignore `frame-ancestors` in a page, so set it as a response header for this path:

```
Content-Security-Policy: frame-ancestors 'none'
```

### Preview on Vercel

`vercel.json` serves the same build at `/tools/fhir-validator/` for team previews. It also tells search engines not to index the preview.

## Data sources

The R4 definitions and examples come from [HL7®](https://hl7.org/fhir/R4/) under
[CC0](https://hl7.org/fhir/R4/license.html).

HL7® and FHIR® are the registered trademarks of Health Level Seven International and the use of
these trademarks does not constitute an endorsement by HL7.
