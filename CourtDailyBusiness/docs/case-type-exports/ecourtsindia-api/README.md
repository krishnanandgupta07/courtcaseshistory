# eCourtsIndia.com API case types (`ct`)

This folder is the **eCourtsIndia.com partner API** taxonomy from
[https://ecourtsindia.com/api/docs#search-capabilities](https://ecourtsindia.com/api/docs#search-capabilities).

It is **not** the NIC High Court CIS dropdown on `hcservices.ecourts.gov.in`.
Those CIS codes look like `WP - WRIT PETITION`. eCourtsIndia search uses
`WP_C`, `WP_CRL`, `CRL_A`, and so on.

## Two different lists (do not mix)

| List | Example | Per bench? | Used as |
|---|---|---|---|
| Website dropdown `GET /api/casetypes?benchId=` | `WP` WRIT PETITION | Yes | UI only |
| NIC hcservices Case Type | `WP - WRIT PETITION` | Yes | Same kind as the website, **not** this API |
| **eCourtsIndia.com `ct`** | `WP_C` Writ Petition (Civil) | **No — global** | Search facet |

Bench is a **separate** filter: `cc` (court establishment code).

Telangana example that works on eCourtsIndia:

`https://ecourtsindia.com/search?cc=HBHC01&ct=WP_C`

Partner API equivalent:

`GET https://webapi.ecourtsindia.com/api/partner/search?courtCode=HBHC01&caseType=WP_C`

Live enum source (authoritative, 244 codes as of Aug 2026):

`GET https://webapi.ecourtsindia.com/api/partner/enums` → `caseType`

CourtLiveStream proxy of the same list:

`GET https://api.courtlivestream.com/api/admin/ecourts/enums` → `enums.caseType`

Capabilities:

`GET https://webapi.ecourtsindia.com/api/partner/search/capabilities`

Encyclopedia snapshot (not the full 244):

https://blogs.ecourtsindia.com/2026/04/17/case-type-encyclopedia/

## Files here

- `ecourtsindia-case-types.csv` — **all 244** live `ct` codes (`WP_C`, `CRL_A`, …)
- `search-capabilities.csv` — public search URL params (`ct`, `cc`, …) from the docs
- `hc-court-codes.csv` — High Court / SC `cc` codes to combine with `ct`
- `ecourtsindia-api-case-types.xlsx` — Excel with the three sheets above

## How search works

`ct` is global. Sending local CIS `WP` as `ct` returns zero hits.
Sending `ct=WP_C` plus `cc=HBHC01` finds Telangana WP 1290/2019 (CNR `HBHC010022792019`).

Comma-OR is allowed: `ct=WP_C,WP_CRL`.

Wrong codes fail silently (zero results). Do not guess `WRIT` or `CIVIL`.
High Court `cc` needs the bench suffix: `DLHC` is empty; use `DLHC01`.
