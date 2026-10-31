/** Mistakes here are deliberate: one per kind of problem a first-time visitor should see caught. */
export const EXAMPLE_RESOURCE = `{
  "resourceType": "Patient",
  "id": "example",
  "active": "true",
  "name": [
    {
      "use": "official",
      "family": "Chalmers",
      "given": ["Peter", "James"]
    }
  ],
  "gender": "Male",
  "birthdate": "1974-12-25",
  "deceasedDateTime": "2026-02-30T10:00:00Z",
  "maritalStatus": {
    "coding": [
      {
        "code": "M"
      }
    ]
  }
}
`;
