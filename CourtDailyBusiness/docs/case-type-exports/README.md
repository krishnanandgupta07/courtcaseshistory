# Case type comparison exports

Website dropdown = `/api/casetypes?benchId=` (different list per bench).
eCourtsIndia.com search `ct` = one global list of 244 codes (`WP_C`, not CIS `WP`).

## Full bench-wise dropdown mapping (use this)

`dropdown-vs-ecourtsindia/BenchWise_Dropdown_vs_eCourtsIndia.xlsx`

Every type in your dropdown, for every bench, compared to eCourtsIndia:
Exact / Suggested / Review / Conflict / Not available, plus closest guesses.

CSV: `dropdown-vs-ecourtsindia/all-benches-dropdown-vs-ecourtsindia.csv`
Telangana: `dropdown-vs-ecourtsindia/39-Telangana-Hyderabad-all-dropdown-types.csv`

## eCourtsIndia.com 244 `ct` codes

`ecourtsindia-api/` — live enum list + search-capabilities + High Court `cc` codes.
Docs: https://ecourtsindia.com/api/docs#search-capabilities

Do **not** use `ecourts-india-official-bench-check.csv` — that sheet was for
the NIC `hcservices.ecourts.gov.in` CIS dropdown, which is a different list.

## Files

- `All_Benches_CaseType_Comparison.xlsx` — Excel with sheets: Summary, Exact, Suggested, Review, Conflict
- `csv-all-benches/exact.csv`
- `csv-all-benches/suggested.csv`
- `csv-all-benches/review.csv`
- `csv-all-benches/conflict.csv`
- `csv-all-benches/summary-by-bench.csv`
- `csv-by-bench/<benchId>-<court>-<bench>/{exact,suggested,review,conflict}.csv`

Compare columns: `website_case_type_code` vs `ecourts_case_type_code_1..4`,
`website_case_type_name` vs `ecourts_case_type_name_1..4`,
`website_and_ecourts_code_same` (YES/NO), `website_and_ecourts_name_same` (YES/NO).

## Counts

- Exact: 367
- Suggested: 429
- Review: 504
- Conflict: 127
- Benches: 42
