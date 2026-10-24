# Bench-wise dropdown vs eCourtsIndia.com `ct`

eCourtsIndia.com has **one global list of 244 case types**. Those codes are **not** different per bench. Bench is a separate filter (`cc`, e.g. `HBHC01`).

Your application dropdown **is** bench-wise: `GET /api/casetypes?benchId=`.

This export lists **every dropdown type for every bench**, then compares it to the 244 eCourtsIndia `ct` codes.

## Open this Excel

`BenchWise_Dropdown_vs_eCourtsIndia.xlsx`

- **Summary** — counts per bench
- **All_Benches** — all 4,855 dropdown rows
- **One sheet per bench** — every type in that bench’s dropdown (example: `39-Hyderabad`)

Row colours: green = exact, blue = suggested, yellow = review, orange = conflict, grey = not available.

## CSV

- `all-benches-dropdown-vs-ecourtsindia.csv` — same as the All_Benches sheet
- `summary-by-bench.csv`
- `39-Telangana-Hyderabad-all-dropdown-types.csv` — Telangana Hyderabad (91 types, live)
- `csv-by-bench/<benchId>-<court>-<bench>/all-dropdown-types.csv`
- In each bench folder also: `exact.csv`, `suggested.csv`, `review.csv`, `conflict.csv`, `not-available.csv`

## How to read a row

| Column | Meaning |
|---|---|
| `website_dropdown_case_type_*` | What the lawyer sees in **your** dropdown |
| `match_type` | Exact / Suggested / Review / Conflict / Not available |
| `ecourtsindia_ct_code_1..4` | eCourtsIndia `ct` to search (backend map) |
| `closest_if_not_available_*` | Best guess when there is no real match — **do not auto-seed** |
| `use_in_backend_map` | Whether to put this in `case_type_ecourts_map` |

## Telangana High Court — Hyderabad (bench 39)

Live dropdown is **91 types**, not 200. Of those:

| Status | Count | Backend |
|---|---:|---|
| Exact match | 11 | Seed |
| Suggested map (e.g. `WP` → `WP_C`, `WP_CRL`) | 31 | Seed |
| Review | 8 | Confirm first |
| Conflict (`CA`, `CC`, `RC`, `STA`) | 4 | Do not send local code |
| Not available in eCourtsIndia | 37 | Fail-open with local code; closest guess is for review |

Example: dropdown `WP` / WRIT PETITION → eCourtsIndia `WP_C`, `WP_CRL` with `cc=HBHC01`.
