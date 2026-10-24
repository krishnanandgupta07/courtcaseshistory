# Case type mapping: our website vs eCourts

This document is for the **CourtLiveStream backend**. The website (Court Daily Business / Court Case History) must keep using **our** case type API for High Court and Supreme Court dropdowns. eCourts search uses a **different** case-type taxonomy. Mapping belongs in `GET /api/admin/ecourts/search/by-case-number`.

Companion files:

- `docs/case-type-ecourts-map.seed.json` — seed rows (exact + suggested only)
- Interactive full table (all 4,855 local types) lives in the frontend mapping canvas

## Backend implementation prompt

Copy everything in this section to the backend agent or engineer.

```
You are implementing backend support for Court Daily Business / Court Case History High Court + Supreme Court Case Status Search.

## Problem (verified)

The website dropdown uses OUR case types API:
  GET /api/casetypes?benchId={benchId}
Example: Telangana HC Hyderabad benchId=39, code `WP`, name `WRIT PETITION`.

Case-number search currently forwards that local code to eCourts:
  GET /api/admin/ecourts/search/by-case-number
    ?courtCode={eCourtsCourtCode}
    &courtLevel=HC|SC
    &caseTypeCode={localCode}   // today this is used as an exact eCourts caseType facet
    &caseNumber={number}
    &year={year}

eCourts indexes a different taxonomy (`/api/admin/ecourts/enums` → enums.caseType).
Verified: Telangana WP 1290/2019, courtCode HBHC01
  caseTypeCode=WP    → 0 hits
  caseTypeCode=WP_C  → CNR HBHC010022792019
CNR lookup GET /api/admin/ecourts/case/{cnr} already works because it does not filter by case type.

Do NOT change the frontend dropdown. Keep serving /api/casetypes. Map in this search API.

## What to build

1. Table `case_type_ecourts_map` (name flexible):
   - bench_id        INT      -- our benches.id (39 = Telangana Hyderabad)
   - local_code      TEXT     -- code from /api/casetypes
   - ecourts_codes   TEXT[]   -- one or more eCourts caseType enum codes
   - local_name      TEXT     -- optional, for admins
   - UNIQUE (bench_id, local_code)

2. Seed from the JSON file `case-type-ecourts-map.seed.json` (exact + suggested rows only).
   Mapping MUST be per bench. The same local code can mean different things in different courts.
   Example: Telangana `WP` = Writ Petition → WP_C, WP_CRL.
   Gauhati/Gujarat `WP` is labeled "Matters transfered under Section 446(3)(116)" — do NOT map those to WP_C.

3. Change by-case-number search:
   a. Resolve ecourts_codes = map[benchId][localCode] if present, else [localCode].
   b. Always include the original localCode in the search set (union), except when it is a documented CONFLICT with a different eCourts meaning (see below).
   c. Run the partner/eCourts facet search for each code (or OR-query if the index supports it).
   d. Merge hits by CNR (case-insensitive).
   e. Keep existing refresh meta behaviour.

4. Do not switch High Court dropdowns to eCourts enums. Those enums mix tribunals (GSTAT, SEBI, DRT, CAT) and use WP_C instead of the labels lawyers type on our site.

5. Court code for search is the eCourts courtCode (Telangana HC Hyderabad = HBHC01), not the CNR prefix HBHC and not our bench UUID/id.

## Conflict codes (never treat as the eCourts code of the same letters unless names match)

When local NAME does not match the eCourts enum name, do not facet on the local code:
  CA  — our site often "Contempt Appeal"; eCourts CA = Civil Appeal. Prefer CONMT if mapped.
  CC  — our site often "Contempt Case"; eCourts CC = Criminal Complaint Case. Prefer CONMT if mapped.
  RC  — our site often "Referred Case"; eCourts RC = Rent Control Case. Do not map.
  STA — our site often "Special Tribunal Appeal"; eCourts STA = Sur Tax Appeal. Do not map.

## High-value aliases (use only when local name is actually that proceeding)

  WP, W.P., CWP (civil writ)     → WP_C and/or WP_CRL depending on civil vs criminal in the local name
  WP(PIL), PIL, CWPIL            → WP_PIL, WP_C_PIL, PIL
  CRLA, CRL.A, CRA (criminal appeal) → CRL_A
  WA (writ appeal)               → WA   (never WA_GSTAT)
  SLP, SCLP                      → SLP_C, SLP_CRL
  CRLP                           → CRLP only if name is criminal petition/leave, not a writ
  COMS                           → COM_S
  X-OBJ, XOBJ                    → XOBJ, CO

## Acceptance test

Telangana High Court, Hyderabad, courtCode=HBHC01, courtLevel=HC,
case type WP (from our casetypes API), caseNumber=1290, year=2019
MUST return CNR HBHC010022792019 (same payload CNR search already returns).

Also: a type with no map (High Court-specific commercial/transfer types) must still be searchable using the local code, not fail closed.

## Out of scope

District Court and Tribunal already use eCourts reference case types — do not apply this HC/SC map there.
Do not hardcode WP_C in the CourtDailyBusiness frontend.
```

## Sources

| Source | Endpoint | Role |
|---|---|---|
| Our website dropdown | `GET /api/casetypes?benchId=` | Local codes/names lawyers select (91 types on Telangana Hyderabad, 4,855 across 42 benches) |
| Our benches | `GET /api/app/courts/list` | 43 benches; Srinagar benchId 43 currently has **zero** case types |
| eCourts search facet | `GET /api/admin/ecourts/enums` → `enums.caseType` | 244 global codes such as `WP_C`, `CRL_A`, `WA` |
| Case-number search | `GET /api/admin/ecourts/search/by-case-number` | Today filters `caseType` **exactly** as `caseTypeCode` |
| CNR search | `GET /api/admin/ecourts/case/{cnr}` | No case-type filter; already correct |

## How the taxonomies differ

1. **Our list is per High Court bench** (cause-list / local CIS codes). eCourts enums are **one global list** mixed with tribunals (GSTAT, SEBI, DRT, CAT, NGT).
2. **Writs are split on eCourts:** local `WP` / `CWP` / `WPA` vs eCourts `WP_C` (civil) and `WP_CRL` (criminal). This is why Telangana WP 1290/2019 was empty on Case Status Search and present on CNR search.
3. **Same letters, different meaning** across courts. Never map by code alone. `CA` is Contempt Appeal on Telangana and Civil Appeal on eCourts.
4. **Most local types have no eCourts equivalent** (defective variants, BNSS sections, land grabbing, CCCA, commercial transfer, suo motu local codes). Still search the local code; do not drop the query.
5. **Sister benches of one High Court often share the same list** (Allahabad Prayagraj/Lucknow, Karnataka three benches, MP three benches). Seed still per `bench_id` so lists can diverge later.
6. **Srinagar** (Jammu & Kashmir and Ladakh High Court, benchId 43) returned an empty casetypes list. No map until types are seeded in our DB.

## Totals

| Match | Count | Meaning |
|---|---:|---|
| Exact | 367 | Same code and compatible name — search as-is |
| Suggested | 429 | Backend should search the listed eCourts codes |
| Review | 504 | Related, confirm before seeding |
| Conflict | 127 | Same letters, different meaning — do not send local code as facet |
| No eCourts type | 3428 | High Court-specific — search local code only |
| **All local type rows** | **4855** | 42 benches with data |

## Bench summary

| Court | Bench | benchId | Local types | Exact | Suggested | Review | Conflict | No eCourts type |
|---|---|---|---:|---:|---:|---:|---:|---:|
| Allahabad High Court | Allahabad(Prayagraj) | 1 | 154 | 1 | 17 | 24 | 0 | 112 |
| Allahabad High Court | Lucknow | 2 | 154 | 1 | 17 | 24 | 0 | 112 |
| Andhra Pradesh High Court | Amaravati | 3 | 80 | 10 | 26 | 2 | 4 | 38 |
| Bombay High Court | Aurangabad | 5 | 66 | 10 | 11 | 13 | 4 | 28 |
| Bombay High Court | Kolhapur | 8 | 130 | 7 | 8 | 15 | 4 | 96 |
| Bombay High Court | Mumbai | 4 | 119 | 6 | 7 | 11 | 4 | 91 |
| Bombay High Court | Nagpur | 6 | 93 | 11 | 12 | 13 | 3 | 54 |
| Bombay High Court | Panaji | 7 | 78 | 7 | 13 | 16 | 1 | 41 |
| Calcutta High Court | Jalpaiguri | 10 | 71 | 5 | 3 | 9 | 2 | 52 |
| Calcutta High Court | Port Blair | 11 | 66 | 5 | 3 | 11 | 2 | 45 |
| Calcutta High Court | kolkata | 9 | 134 | 2 | 5 | 4 | 5 | 118 |
| Chhattisgarh High Court | Bilaspur | 12 | 62 | 3 | 13 | 0 | 5 | 41 |
| Delhi High Court | New Delhi | 13 | 154 | 10 | 13 | 5 | 1 | 125 |
| Gauhati High Court | Aizawl | 15 | 79 | 5 | 4 | 5 | 4 | 61 |
| Gauhati High Court | Guwahati | 14 | 112 | 10 | 2 | 4 | 2 | 94 |
| Gauhati High Court | Itanagar | 16 | 135 | 6 | 4 | 9 | 1 | 115 |
| Gauhati High Court | Kohima | 17 | 217 | 11 | 10 | 15 | 7 | 174 |
| Gujarat High Court | Ahmedabad | 18 | 217 | 11 | 10 | 15 | 7 | 174 |
| Himachal Pradesh High Court | Shimla | 19 | 91 | 12 | 8 | 7 | 1 | 63 |
| Jammu & Kashmir and Ladakh High Court | Jammu | 20 | 234 | 9 | 9 | 3 | 4 | 209 |
| Jharkhand High Court | Ranchi | 21 | 64 | 14 | 2 | 3 | 4 | 41 |
| Karnataka High Court | Bengaluru | 22 | 72 | 13 | 10 | 18 | 0 | 31 |
| Karnataka High Court | Dharwad | 23 | 72 | 13 | 10 | 18 | 0 | 31 |
| Karnataka High Court | Kalaburagi | 24 | 72 | 13 | 10 | 17 | 0 | 32 |
| Kerala High Court | Kochi | 25 | 75 | 13 | 7 | 3 | 4 | 48 |
| Madhya Pradesh High Court | Gwalior | 27 | 104 | 13 | 14 | 15 | 4 | 58 |
| Madhya Pradesh High Court | Indore | 28 | 104 | 13 | 14 | 15 | 4 | 58 |
| Madhya Pradesh High Court | Jabalpur | 26 | 104 | 13 | 14 | 15 | 4 | 58 |
| Madras High Court | Chennai | 29 | 169 | 8 | 14 | 27 | 3 | 117 |
| Madras High Court | Madurai | 30 | 124 | 6 | 4 | 6 | 0 | 108 |
| Manipur High Court | Imphal | 31 | 218 | 14 | 7 | 16 | 4 | 177 |
| Meghalaya High Court | Shillong | 32 | 226 | 11 | 11 | 12 | 10 | 182 |
| Orissa High Court | Cuttack | 33 | 160 | 10 | 15 | 2 | 8 | 125 |
| Patna High Court | Patna | 34 | 45 | 6 | 9 | 5 | 2 | 23 |
| Punjab and Haryana High Court | Chandigarh | 35 | 131 | 15 | 13 | 25 | 3 | 75 |
| Rajasthan High Court | Jaipur | 37 | 94 | 6 | 8 | 35 | 1 | 44 |
| Rajasthan High Court | Jodhpur | 36 | 118 | 8 | 8 | 23 | 2 | 77 |
| Sikkim High Court | Gangtok | 38 | 40 | 4 | 4 | 4 | 1 | 27 |
| Supreme Court | Supreme Court | 42 | 34 | 1 | 15 | 8 | 0 | 10 |
| Telangana High Court | Hyderabad | 39 | 91 | 11 | 31 | 8 | 4 | 37 |
| Tripura High Court | Agartala | 40 | 94 | 11 | 12 | 11 | 5 | 55 |
| Uttarakhand High Court | Nainital | 41 | 198 | 9 | 2 | 13 | 3 | 171 |

## Differences by bench

### Allahabad High Court — Allahabad(Prayagraj)

- **benchId:** `1` · **local types:** 154
- **Exact:** 1 · **Suggested:** 17 · **Review:** 24 · **Conflict:** 0 · **No eCourts type:** 112
- **Writ-related maps:** `CRLP` → `CRLP`, `CRPIL` → `WP_C_PIL, WP_PIL, PIL`, `HABC` → `HCP`, `WPIL` → `WP_C_PIL, WP_PIL, PIL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `APPL` | APPL. | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CLRE` | CIVIL REVISION | `C_REV` | Civil Revision |
| `COPP` | COMPANY PETITION | `COP` | Company Petition |
| `CRLA` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRLP` | CRIMINAL MISC. WRIT PETITION | `CRLP` | Criminal Leave Petition |
| `CRLR` | CRIMINAL REVISION | `CR_REV, CRLRC` | Criminal Revision | Criminal Revision Case |
| `CROB` | CROSS OBJECTION | `CO, XOBJ` | Cross Objection | Cross Objection |
| `CUSA` | CUSTOMS APPEAL | `CU_CESTAT` | Customs Appeal |
| `ELEP` | ELECTION PETITION | `EP` | Election Petition |
| `EAPL` | ESTATE DUTY APPEAL | `EDA` | Estate Duty Appeal |
| `FAPL` | FIRST APPEAL | `FA` | First Appeal |
| `GAPL` | GIFT TAX APPEAL | `GTA` | Gift Tax Appeal |
| `IAPL` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `OSUT` | ORIGINAL SUIT | `OS` | Original Suit |
| `SAPL` | SECOND APPEAL | `SA` | Second Appeal |
| `TESU` | TESTAMENTARY SUIT | `TS` | Testamentary Suit |
| `WAPL` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `RERA` | RERA APPEAL | `RERA` | RERA Appeal |
### Allahabad High Court — Lucknow

- **benchId:** `2` · **local types:** 154
- **Exact:** 1 · **Suggested:** 17 · **Review:** 24 · **Conflict:** 0 · **No eCourts type:** 112
- **Writ-related maps:** `CRLP` → `CRLP`, `CRPIL` → `WP_C_PIL, WP_PIL, PIL`, `HABC` → `HCP`, `WPIL` → `WP_C_PIL, WP_PIL, PIL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `APPL` | APPL. | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CLRE` | CIVIL REVISION | `C_REV` | Civil Revision |
| `COPP` | COMPANY PETITION | `COP` | Company Petition |
| `CRLA` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRLP` | CRIMINAL MISC. WRIT PETITION | `CRLP` | Criminal Leave Petition |
| `CRLR` | CRIMINAL REVISION | `CR_REV, CRLRC` | Criminal Revision | Criminal Revision Case |
| `CROB` | CROSS OBJECTION | `CO, XOBJ` | Cross Objection | Cross Objection |
| `CUSA` | CUSTOMS APPEAL | `CU_CESTAT` | Customs Appeal |
| `ELEP` | ELECTION PETITION | `EP` | Election Petition |
| `EAPL` | ESTATE DUTY APPEAL | `EDA` | Estate Duty Appeal |
| `FAPL` | FIRST APPEAL | `FA` | First Appeal |
| `GAPL` | GIFT TAX APPEAL | `GTA` | Gift Tax Appeal |
| `IAPL` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `OSUT` | ORIGINAL SUIT | `OS` | Original Suit |
| `SAPL` | SECOND APPEAL | `SA` | Second Appeal |
| `TESU` | TESTAMENTARY SUIT | `TS` | Testamentary Suit |
| `WAPL` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `RERA` | RERA APPEAL | `RERA` | RERA Appeal |
### Andhra Pradesh High Court — Amaravati

- **benchId:** `3` · **local types:** 80
- **Exact:** 10 · **Suggested:** 26 · **Review:** 2 · **Conflict:** 4 · **No eCourts type:** 38
- **Writ-related maps:** `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(PIL)` → `WP_PIL, WP_C_PIL, PIL`, `WA` → `WA`, `WP` → `WP_C, WP_CRL`, `WP(TR)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (CONTEMPT APPEAL(4)), `CC` (CONTEMPT CASE(6)), `RC` (REFERRED CASE(40)), `STA` (SPECIAL TRIBUNAL APPEAL(52))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AS` | APPEAL SUIT(3) | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `APPL` | APPLICATION IN CIVIL SUIT(1) | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `ARBAPPL` | ARBITRATION APPLICATION(2) | `ARB_PET, Arb_Pet, ARB_A` | Arbitration Petition (uppercase variant) | Arbitration Petition | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEALS(9) | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `COMS` | COMMERCIAL SUIT(16) | `COM_S` | Commercial Suit |
| `CAPPEAL` | COMPANY APPEAL(5) | `CAPP_CA, CAPP_AT` | Company Appeal (Companies Act) | Company Appeal (AT) |
| `CP` | COMPANY PETITION(18) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRLA` | CRIMINAL APPEAL(19) | `CRL_A` | Criminal Appeal |
| `CRLATR` | CRIMINAL APPEAL TRANSFER(72) | `CRL_A` | Criminal Appeal |
| `X-OBJ` | Cross Objection(70) | `XOBJ, CO` | Cross Objection | Cross Objection |
| `EDC` | ESTATE DUTY CASE(25) | `EDA` | Estate Duty Appeal |
| `EXEP` | EXECUTION PETITION(28) | `EA` | Execution Application (Civil) |
| `GTC` | GIFT TAX CASE(30) | `GTA` | Gift Tax Appeal |
| `ITC` | INCOME TAX CASE(31) | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |
| `ITTA` | INCOME TAX TRIBUNAL APPEAL(32) | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL(35) | `LPA` | Letters Patent Appeal |
| `MACMA` | MOTOR ACCIDENT CIVIL MISCELLANEOUS APPEAL(36) | `MACA` | Motor Accident Claims Appeal |
| `OP` | ORIGINAL PETITION(37) | `OMP` | Original Miscellaneous Petition |
| `REFCRLA` | REFERRED CRLA(43) | `CRL_A` | Criminal Appeal |
| `SCLP` | SUPREME COURT LEAVE PETITION(50) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| … | 6 more | | |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPEAL(12) | `CMA` | Civil Miscellaneous Appeal |
| `CRP` | CIVIL REVISION PETITION(23) | `CRP` | Civil Revision Petition |
| `CS` | CIVIL SUIT(24) | `CS` | Civil Suit |
| `CRLP` | CRIMINAL PETITION(21) | `CRLP` | Criminal Leave Petition |
| `CRLRC` | CRIMINAL REVISION CASE(22) | `CRLRC` | Criminal Revision Case |
| `EP` | ELECTION PETITION(26) | `EP` | Election Petition |
| `PIL` | PUBLIC INTEREST LITIGATION(39) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `SA` | SECOND APPEAL(49) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL(66) | `WTA` | Wealth Tax Appeal |
| `WA` | WRIT APPEAL(62) | `WA` | Writ Appeal |
### Bombay High Court — Aurangabad

- **benchId:** `5` · **local types:** 66
- **Exact:** 10 · **Suggested:** 11 · **Review:** 13 · **Conflict:** 4 · **No eCourts type:** 28
- **Writ-related maps:** `SMWP` → `WP_CRL`, `WP-Y` → `WP_CRL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP-Z` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `REF` (Criminal Reference), `RC` (Rejected Case), `RA` (Review Application (Civil)), `STA` (Sales Tax Application)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARBA` | Arbitration Appeal | `ARB_A` | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEAL | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CMA` | Company Application | `CMA` | Civil Miscellaneous Appeal |
| `CMP` | COMPANY PETITION | `COP` | Company Petition |
| `CP` | Cont. Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRA` | CRA | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `APEAL` | criminal Appeal | `CRL_A` | Criminal Appeal |
| `WP-Y` | Criminal Writ Petition | `WP_CRL` | Writ Petition (Criminal) |
| `CSA` | CUSTOMS APPEAL | `CU_CESTAT` | Customs Appeal |
| `SPLCA` | Special Civil Application | `SCA` | Special Civil Application |
| `X-OBJ` | X-Objection | `XOBJ, CO` | Cross Objection | Cross Objection |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ABA` | ANTICIPATORY BAIL APPLICATION | `ABA` | Anticipatory Bail Application |
| `ARB` | ARBITRATION APPLICATION | `Arb` | Arbitration Case (DC) |
| `BA` | BAIL APPLICATION | `BA` | Bail Application |
| `EP` | Election petition | `EP` | Election Petition |
| `FA` | First Appeal | `FA` | First Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | Letter Patent Appeal | `LPA` | Letters Patent Appeal |
| `PIL` | Public Interest Litigation | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | Wealth Tax Apeal | `WTA` | Wealth Tax Appeal |
### Bombay High Court — Kolhapur

- **benchId:** `8` · **local types:** 130
- **Exact:** 7 · **Suggested:** 8 · **Review:** 15 · **Conflict:** 4 · **No eCourts type:** 96
- **Writ-related maps:** `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP-Z` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `CRR` (Court Receiver Report), `REF` (Cr. Reference), `IA` (INTERIM APPLICATION), `RC` (Rejected Case)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARP` | Arbitration Petition | `Arb_Pet` | Arbitration Petition |
| `CRA` | Civil Revision Application | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CP` | Cont. Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `ABA` | Cr. Anticipatory Bail Appln. | `ABA` | Anticipatory Bail Application |
| `BA` | Criminal Bail Appln. | `BA` | Bail Application |
| `IRXA` | INTEREST TAX APPEAL | `INTTA` | Interest Tax Appeal |
| `CRPIL` | Public Interest Litigation | `PIL` | Public Interest Litigation |
| `SPLCA` | Special Civil Application | `SCA` | Special Civil Application |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `FEMA` | FEMA APPEAL | `FEMA` | FEMA Case |
| `FA` | First Appeal | `FA` | First Appeal |
| `LPA` | Letter Patent Appeal | `LPA` | Letters Patent Appeal |
| `PIL` | Public Interest Litigation | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `RPC` | Review Petn. in CRA | `RP_C` | Review Petition (Civil) |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Bombay High Court — Mumbai

- **benchId:** `4` · **local types:** 119
- **Exact:** 6 · **Suggested:** 7 · **Review:** 11 · **Conflict:** 4 · **No eCourts type:** 91
- **Writ-related maps:** `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP-Z` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `CRR` (Court Receiver Report), `REF` (Cr. Reference), `IA` (INTERIM APPLICATION), `RC` (Rejected Case)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARP` | Arbitration Petition | `Arb_Pet` | Arbitration Petition |
| `CRA` | Civil Revision Application | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CP` | Cont. Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `ABA` | Cr. Anticipatory Bail Appln. | `ABA` | Anticipatory Bail Application |
| `BA` | Criminal Bail Appln. | `BA` | Bail Application |
| `CRPIL` | Public Interest Litigation | `PIL` | Public Interest Litigation |
| `SPLCA` | Special Civil Application | `SCA` | Special Civil Application |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `FEMA` | FEMA APPEAL | `FEMA` | FEMA Case |
| `FA` | First Appeal | `FA` | First Appeal |
| `LPA` | Letter Patent Appeal | `LPA` | Letters Patent Appeal |
| `PIL` | Public Interest Litigation | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `RPC` | Review Petn. in CRA | `RP_C` | Review Petition (Civil) |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Bombay High Court — Nagpur

- **benchId:** `6` · **local types:** 93
- **Exact:** 11 · **Suggested:** 12 · **Review:** 13 · **Conflict:** 3 · **No eCourts type:** 54
- **Writ-related maps:** `WP©` → `WP_CRL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `REF` (Criminal Reference), `RC` (Rejected Case), `STA` (SALES TAX APPLICATION)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARP` | Arbitration Petition | `Arb_Pet` | Arbitration Petition |
| `CRA` | Civil Revision Application | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CMP` | Company Petition | `COP` | Company Petition |
| `CP` | Cont. Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `ABA` | Cr. Anticipatory Bail Applications | `ABA` | Anticipatory Bail Application |
| `BA` | Cr. Bail Applications | `BA` | Bail Application |
| `APEAL` | Criminal Appeal | `CRL_A` | Criminal Appeal |
| `WP©` | Criminal Writ Petition | `WP_CRL` | Writ Petition (Criminal) |
| `XOB` | Cross Objection | `CO, XOBJ` | Cross Objection | Cross Objection |
| `ITL` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `SPLCA` | Special Civil Application | `SCA` | Special Civil Application |
| `WP` | Writ Petition | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CS` | Civil Suits (Transfer Civil Suit) | `CS` | Civil Suit |
| `EP` | Election petition | `EP` | Election Petition |
| `FA` | First Appeal | `FA` | First Appeal |
| `GTA` | Gift Tax application | `GTA` | Gift Tax Appeal |
| `ITA` | Income tax application | `ITA` | Income Tax Appeal |
| `LPA` | Letter Patent Appeal | `LPA` | Letters Patent Appeal |
| `PIL` | Public Interest Litigation | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `RPC` | Review Petn. in CRA | `RP_C` | Review Petition (Civil) |
| `RPC.` | Review Petn. in FCA | `RP_C` | Review Petition (Civil) |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | Wealth Tax application | `WTA` | Wealth Tax Appeal |
### Bombay High Court — Panaji

- **benchId:** `7` · **local types:** 78
- **Exact:** 7 · **Suggested:** 13 · **Review:** 16 · **Conflict:** 1 · **No eCourts type:** 41
- **Writ-related maps:** `WPCR` → `WP_CRL`, `PILCW` → `WP_CRL`, `PILWP` → `WP_PIL, WP_C_PIL`, `SMCWP` → `WP_CRL`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `STA` (Stamp Number (Appln.))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AS` | Admiralty Suit | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `ARP` | Arbitration Petition | `Arb_Pet` | Arbitration Petition |
| `CRA` | Civil Revision Application | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CP` | Contempt Petition | `CONMT, COP, CP_CA` | Contempt Petition | Company Petition | Company Petition (Companies Act) |
| `CRIA` | Criminal Appeal | `CRL_A` | Criminal Appeal |
| `WPCR` | Criminal Writ Petition | `WP_CRL` | Writ Petition (Criminal) |
| `XOB` | Cross Objection | `CO, XOBJ` | Cross Objection | Cross Objection |
| `ELEP` | Election Petition | `EP` | Election Petition |
| `EXA` | Excise Appeal | `EX_CESTAT` | Excise Appeal |
| `PROP` | Probate Petition | `PP` | Probate Petition |
| `PILWP` | Public Interest Litigation WP | `WP_PIL, WP_C_PIL` | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `STXA` | Service Tax Appeal | `SV_CESTAT` | Service Tax Appeal |
| `WP` | Writ Petition | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CS` | Civil Suit | `CS` | Civil Suit |
| `COP` | Company Petition | `COP` | Company Petition |
| `EA` | Execution Application | `EA` | Execution Application (Civil) |
| `FA` | First Appeal | `FA` | First Appeal |
| `ITA` | Income Tax Appeal | `ITA` | Income Tax Appeal |
| `LPA` | Letter Patent Appeal | `LPA` | Letters Patent Appeal |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Calcutta High Court — Jalpaiguri

- **benchId:** `10` · **local types:** 71
- **Exact:** 5 · **Suggested:** 3 · **Review:** 9 · **Conflict:** 2 · **No eCourts type:** 52
- **Writ-related maps:** `WPA` → `WP_C, WP_CRL`, `WPCR` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CO` (CIVIL ORDER/MISC.CAS), `MA` (MANDAMUS APPEAL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRA(DB-AB)` | APPLICATION FOR ANTICIPATORY BAIL | `ABA` | Anticipatory Bail Application |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `DR` | DEATH REFERENCE | `DREF` | Death Reference |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `FA` | CIVIL FIRST APPEAL | `FA` | First Appeal |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `SA` | CIVIL SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `LPA` | LETTERS PATENT APPEAL | `LPA` | Letters Patent Appeal |
### Calcutta High Court — Port Blair

- **benchId:** `11` · **local types:** 66
- **Exact:** 5 · **Suggested:** 3 · **Review:** 11 · **Conflict:** 2 · **No eCourts type:** 45
- **Writ-related maps:** `WPA` → `WP_C, WP_CRL`, `WPCR` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CO` (CIVIL ORDER/MISC.CAS), `MA` (MANDAMUS APPEAL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AP` | ARBITRATION PETITION | `Arb_Pet` | Arbitration Petition |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `DR` | DEATH REFERENCE | `DREF` | Death Reference |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `FA` | CIVIL FIRST APPEAL | `FA` | First Appeal |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `SA` | CIVIL SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `LPA` | LETTERS PATENT APPEAL | `LPA` | Letters Patent Appeal |
### Calcutta High Court — kolkata

- **benchId:** `9` · **local types:** 134
- **Exact:** 2 · **Suggested:** 5 · **Review:** 4 · **Conflict:** 5 · **No eCourts type:** 118
- **Writ-related maps:** `WPCR` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (COMPANY APPLICATION(43)), `CC` (CONTEMPT OF COURT CASES(45)), `IP` (IT.PET.256(2)IT&), `REF` (REFERENCE CASE(82)), `TS` (TESTAMENTERY SUITS(93))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AS` | ADMIRALITY  SUITS(33) | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `CS` | CIVIL SUITS(52) | `CS` | Civil Suit |
| `CP` | COMPANY PETITIONS(48) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRA` | COPYRIGHT APPEAL(50) | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `EP` | ELEC.PET.(PEOPLES REPRESENTATION ACT, 1951)(60) | `EP` | Election Petition |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ITA` | INCOME TAX APPEAL(67) | `ITA` | Income Tax Appeal |
| `LPA` | LETTERS PATENT APPEAL(72) | `LPA` | Letters Patent Appeal |
### Chhattisgarh High Court — Bilaspur

- **benchId:** `12` · **local types:** 62
- **Exact:** 3 · **Suggested:** 13 · **Review:** 0 · **Conflict:** 5 · **No eCourts type:** 41
- **Writ-related maps:** `WP` → `WP_C, WP_CRL`, `WPC` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (CA), `CR` (CR), `CRR` (CRR), `EA` (EA), `MA` (MA)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | CEA | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CP` | CP | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRA` | CRA | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CS` | CS | `CS` | Civil Suit |
| `EP` | EP | `EP` | Election Petition |
| `FA` | FA | `FA` | First Appeal |
| `ITA` | ITA | `ITA` | Income Tax Appeal |
| `LPA` | LPA | `LPA` | Letters Patent Appeal |
| `SA` | SA | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WA` | WA | `WA` | Writ Appeal |
| `WP` | WP | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |
| `WPC` | WPC | `WP_C` | Writ Petition (Civil) |
| `WTA` | WTA | `WTA` | Wealth Tax Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARBA` | ARBA | `ARB_A` | Arbitration Appeal |
| `TPC` | TPC | `TP_C` | Transfer Petition (Civil) |
| `WPPIL` | WPPIL | `WP_PIL` | Writ Petition (Public Interest Litigation) |
### Delhi High Court — New Delhi

- **benchId:** `13` · **local types:** 154
- **Exact:** 10 · **Suggested:** 13 · **Review:** 5 · **Conflict:** 1 · **No eCourts type:** 125
- **Writ-related maps:** `W.P.(C)` → `WP_C`, `W.P.(CRL)` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `SCA` (SUPREME COURT APPL.)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARB.A.` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `BAIL APPLN.` | BAIL APPLICATION | `BA` | Bail Application |
| `CA` | CAVEAT | `CAV` | Caveat |
| `C.R.P.` | CIVIL REVISION | `C_REV, CRP` | Civil Revision | Civil Revision Petition |
| `CS(OS)` | CIVIL SUIT | `CS` | Civil Suit |
| `CO.PET.` | COMPANY PETITION | `COP` | Company Petition |
| `CRL.A.` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRL.REV.P.` | CRIMINAL REVISION | `CR_REV, CRLRC` | Criminal Revision | Criminal Revision Case |
| `EL.PET.` | ELECTION PETITION | `EP` | Election Petition |
| `GTC` | GIFT TAX CASES | `GTA` | Gift Tax Appeal |
| `ITC` | INCOME TAX CASES | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |
| `RSA` | REG. IInd APPEAL | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SERTA` | SERVICE TAX APPEAL | `SV_CESTAT` | Service Tax Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `C.O.` | CIVIL ORIGINAL | `CO` | Cross Objection |
| `W.P.(C)` | CIVIL WRITS | `WP_C` | Writ Petition (Civil) |
| `W.P.(CRL)` | CRIMINAL WRITS | `WP_CRL` | Writ Petition (Criminal) |
| `GTA` | GIFT TAX APPEALS | `GTA` | Gift Tax Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `O.M.P.` | ORGL. MISC. PETITION | `OMP` | Original Miscellaneous Petition |
| `RFA` | REGULAR FIST APPEAL | `RFA, FA` | Regular First Appeal | First Appeal |
| `RC.S.A.` | SEC. APP. FROM ORDER | `RCS_A` | Regular Civil Suit - Class A |
| `WTA` | WEALTH TAX CASE | `WTA` | Wealth Tax Appeal |
### Gauhati High Court — Aizawl

- **benchId:** `15` · **local types:** 79
- **Exact:** 5 · **Suggested:** 4 · **Review:** 5 · **Conflict:** 4 · **No eCourts type:** 61
- **Writ-related maps:** `WA` → `WA`, `W.P.(Crl.)` → `WP_CRL`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(1)), `CO` (Cross Objection in First Appeal(97)), `WP` (Matters transfered under Section 446(3)(116)), `TS` (Testamentory Suit(77))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(166) | `CRL_A` | Criminal Appeal |
| `WA` | Appeal before Division Bench against judgment or order of Single Judge in a Writ Petition.(112) | `WA` | Writ Appeal |
| `CP` | Condonation Petition(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `WP(C)` | Writ Petition under Article 226 and 227 of the Constitution(111) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals under Indian Arbitration Act.(139) | `ARB_A` | Arbitration Appeal |
| `BA` | Bail Application(57) | `BA` | Bail Application |
| `CREV` | Civil Revision(14) | `C_REV` | Civil Revision |
| `CMAppl.` | Miscellaneous Applications | `CMAppl` | Civil Miscellaneous Application |
| `W.P.(Crl.)` | Petition u/a 226 for Writ and Habeas Corpus and other relief in relation to a Cr P(173) | `WP_CRL` | Writ Petition (Criminal) |
### Gauhati High Court — Guwahati

- **benchId:** `14` · **local types:** 112
- **Exact:** 10 · **Suggested:** 2 · **Review:** 4 · **Conflict:** 2 · **No eCourts type:** 94
- **Writ-related maps:** no clear writ map
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(1)), `CO` (Cross Objection in First Appeal(97))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(166) | `CRL_A` | Criminal Appeal |
| `CP` | Condonation Petition(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals under Indian Arbitration Act.(139) | `ARB_A` | Arbitration Appeal |
| `BA` | Bail Application(57) | `BA` | Bail Application |
| `CREV` | Civil Revision(14) | `C_REV` | Civil Revision |
| `CS` | Civil Suit(95) | `CS` | Civil Suit |
| `Crl.P.` | Criminal_Petition(210) | `CRLP` | Criminal Leave Petition |
| `CRREV` | Criminal Revision(56) | `CR_REV` | Criminal Revision |
| `EP` | Election Petition(17) | `EP` | Election Petition |
| `FA` | First_Appeal(18) | `FA` | First Appeal |
| `CMAppl.` | Miscellaneous Applications | `CMAppl` | Civil Miscellaneous Application |
| `CRP` | Revision_Petition(102) | `CRP` | Civil Revision Petition |
### Gauhati High Court — Itanagar

- **benchId:** `16` · **local types:** 135
- **Exact:** 6 · **Suggested:** 4 · **Review:** 9 · **Conflict:** 1 · **No eCourts type:** 115
- **Writ-related maps:** no clear writ map
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(1))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(166) | `CRL_A` | Criminal Appeal |
| `ITA` | Application under Section 256(2)(148) | `ITA` | Income Tax Appeal |
| `CP` | Condonation Petition(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `LPA` | Latters Patent Appeal(23) | `LPA` | Letters Patent Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CREV` | Civil Revision(14) | `C_REV` | Civil Revision |
| `CS` | Civil Suit(95) | `CS` | Civil Suit |
| `FA` | First Appeal(18) | `FA` | First Appeal |
| `IA.` | Interlocutory applications in pending Suits/Appeals(108) | `IA` | Interlocutory Application |
| `MC(RA)` | MISC. CASE (R.A.)(85) | `MCrA` | Miscellaneous Criminal Application |
| `CRP` | Revision Petition(102) | `CRP` | Civil Revision Petition |
### Gauhati High Court — Kohima

- **benchId:** `17` · **local types:** 217
- **Exact:** 11 · **Suggested:** 10 · **Review:** 15 · **Conflict:** 7 · **No eCourts type:** 174
- **Writ-related maps:** `WA` → `WA`, `W.P.(Crl.)` → `WP_CRL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(1)), `CO` (Cross Objection in First Appeal(97)), `MFA` (First Appeal against judgments in Special jurisdiction cases.(144)), `WP` (Matters transfered under Section 446(3)(116)), `RA` (Review Application(70)), `SCA` (SUPREME COURT APPEAL(84)), `TS` (Testamentory Suit(77))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(166) | `CRL_A` | Criminal Appeal |
| `WA` | Appeal before Division Bench against judgment or order of Single Judge in a Writ Petition.(112) | `WA` | Writ Appeal |
| `ITA` | Application under Section 256(2)(148) | `ITA` | Income Tax Appeal |
| `CP` | Condonation Petition(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `RFA` | First Appeal from Judgment and Decree in Suit(96) | `RFA, FA` | Regular First Appeal | First Appeal |
| `LPA` | Latters Patent Appeal(23) | `LPA` | Letters Patent Appeal |
| `SCLP` | Petition for Leave to Appeal to Supreme Court(113) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `RSA` | Second Appeal from Judgment and Decree(99) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SLP` | Special Leave Petition(203) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `WP(C)` | Writ Petition under Article 226 and 227 of the Constitution(111) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals under Indian Arbitration Act.(139) | `ARB_A` | Arbitration Appeal |
| `CS` | Civil Suit(95) | `CS` | Civil Suit |
| `FA` | First Appeal(18) | `FA` | First Appeal |
| `I.A.` | Interlocutory Application.(218) | `IA` | Interlocutory Application |
| `MC(RA)` | MISC. CASE (R.A.)(85) | `MCrA` | Miscellaneous Criminal Application |
| `CMAppl.` | Miscellaneous Applications | `CMAppl` | Civil Miscellaneous Application |
| `W.P.(Crl.)` | Petition u/a 226 for Writ and Habeas Corpus and other relief in relation to a Cr P(173) | `WP_CRL` | Writ Petition (Criminal) |
| `PIL` | Public Interest Litigation(93) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `CRP` | Revision Petition(102) | `CRP` | Civil Revision Petition |
| `RCSA` | Second Appeal(130) | `RCS_A` | Regular Civil Suit - Class A |
| `SA` | Second Appeal(39) | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Gujarat High Court — Ahmedabad

- **benchId:** `18` · **local types:** 217
- **Exact:** 11 · **Suggested:** 10 · **Review:** 15 · **Conflict:** 7 · **No eCourts type:** 174
- **Writ-related maps:** `WA` → `WA`, `W.P.(Crl.)` → `WP_CRL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(1)), `CO` (Cross Objection in First Appeal(97)), `MFA` (First Appeal against judgments in Special jurisdiction cases.(144)), `WP` (Matters transfered under Section 446(3)(116)), `RA` (Review Application(70)), `SCA` (SUPREME COURT APPEAL(84)), `TS` (Testamentory Suit(77))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(166) | `CRL_A` | Criminal Appeal |
| `WA` | Appeal before Division Bench against judgment or order of Single Judge in a Writ Petition.(112) | `WA` | Writ Appeal |
| `ITA` | Application under Section 256(2)(148) | `ITA` | Income Tax Appeal |
| `CP` | Condonation Petition(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `RFA` | First Appeal from Judgment and Decree in Suit(96) | `RFA, FA` | Regular First Appeal | First Appeal |
| `LPA` | Latters Patent Appeal(23) | `LPA` | Letters Patent Appeal |
| `SCLP` | Petition for Leave to Appeal to Supreme Court(113) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `RSA` | Second Appeal from Judgment and Decree(99) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SLP` | Special Leave Petition(203) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `WP(C)` | Writ Petition under Article 226 and 227 of the Constitution(111) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals under Indian Arbitration Act.(139) | `ARB_A` | Arbitration Appeal |
| `CS` | Civil Suit(95) | `CS` | Civil Suit |
| `FA` | First Appeal(18) | `FA` | First Appeal |
| `I.A.` | Interlocutory Application.(218) | `IA` | Interlocutory Application |
| `MC(RA)` | MISC. CASE (R.A.)(85) | `MCrA` | Miscellaneous Criminal Application |
| `CMAppl.` | Miscellaneous Applications | `CMAppl` | Civil Miscellaneous Application |
| `W.P.(Crl.)` | Petition u/a 226 for Writ and Habeas Corpus and other relief in relation to a Cr P(173) | `WP_CRL` | Writ Petition (Criminal) |
| `PIL` | Public Interest Litigation(93) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `CRP` | Revision Petition(102) | `CRP` | Civil Revision Petition |
| `RCSA` | Second Appeal(130) | `RCS_A` | Regular Civil Suit - Class A |
| `SA` | Second Appeal(39) | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Himachal Pradesh High Court — Shimla

- **benchId:** `19` · **local types:** 91
- **Exact:** 12 · **Suggested:** 8 · **Review:** 7 · **Conflict:** 1 · **No eCourts type:** 63
- **Writ-related maps:** `CWP` → `WP_C`, `CWPIL` → `WP_C_PIL, WP_PIL`, `CWP-T` → `TP_C, WP_C`, `CRWP` → `WP_CRL`, `CRWPL` → `WP_C_PIL, WP_PIL`
- **Code conflicts (do not send local code as eCourts facet):** `OMP` (Original Misc. Petition(17))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARB.P` | Arbirtration Petition(16) | `ARB_PET, Arb_Pet` | Arbitration Petition (uppercase variant) | Arbitration Petition |
| `CEA` | Central Excise Appeal(53) | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CWP` | Civil Writ Petition(1) | `WP_C` | Writ Petition (Civil) |
| `COMS` | Commercial Suit(69) | `COM_S` | Commercial Suit |
| `CR.A` | Criminal Appeal(304) | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRWP` | Criminal Writ Petition(301) | `WP_CRL` | Writ Petition (Criminal) |
| `LPA` | Letter Patent Appeal(22) | `LPA` | Letters Patent Appeal |
| `SA` | Succession Application(314) | `SA, RSA` | Second Appeal | Regular Second Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARB.A` | Arbitration Appeal(49) | `ARB_A` | Arbitration Appeal |
| `C.REV` | Civil Review Petition(29) | `C_REV` | Civil Revision |
| `CS` | Civil Suit(5) | `CS` | Civil Suit |
| `CO.P` | Company Petition(3) | `COP` | Company Petition |
| `CR.R` | Criminal Revision Petition(305) | `CRR` | Criminal Revision (DC) |
| `CO` | Cross Objection(32) | `CO` | Cross Objection |
| `GTA` | Gift Tax Appeal(54) | `GTA` | Gift Tax Appeal |
| `ITA` | Income Tax Appeal(44) | `ITA` | Income Tax Appeal |
| `PP` | Probate Petition(14) | `PP` | Probate Petition |
| `RFA` | Regular First Appeal(21) | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Regular Second Appeal(23) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `WTA` | Wealth Tax Appeal(46) | `WTA` | Wealth Tax Appeal |
### Jammu & Kashmir and Ladakh High Court — Jammu

- **benchId:** `20` · **local types:** 234
- **Exact:** 9 · **Suggested:** 9 · **Review:** 3 · **Conflict:** 4 · **No eCourts type:** 209
- **Writ-related maps:** `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(C)PIL` → `WP_C_PIL`, `WP(C)` → `WP_C`, `WP(Crl)` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `MA` (CIVIL IST MISC. APPEALS(23)), `CR` (CIVIL REVISIONS(25)), `CRR` (CRIMINAL REVISIONS(42)), `EA` (EXCISE TAX APPEAL -DB(322))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `RFA` | 1st APPEAL-S.B(336) | `RFA, FA` | Regular First Appeal | First Appeal |
| `Arb P` | ARBITRATION PETITIONS -SB(329) | `ARB_PET, Arb_Pet` | Arbitration Petition (uppercase variant) | Arbitration Petition |
| `CEA` | CENTRAL EXCISE ACT APPEAL(208) | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `RSA` | CIVIL 2nd APPEAL -SB(326) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `CRA` | CRIMINAL APPEALS(39) | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `ITC` | Income Tax Cases(339) | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |
| `CP` | PETITION UNDER COMPANIES ACT(38) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `WP(C)` | WRIT PETITION(300) | `WP_C` | Writ Petition (Civil) |
| `WP(Crl)` | WRIT PETITION CRIMINAL(328) | `WP_CRL` | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `BA` | BAIL APPLICATION(50) | `BA` | Bail Application |
| `OS` | CIVIL ORIGINAL SUIT(31) | `OS` | Original Suit |
| `EP` | ELECTION PETITION(76) | `EP` | Election Petition |
| `HCP` | HABEAS CORPUS PETITION(17) | `HCP` | Habeas Corpus Petition |
| `ITA` | INCOME TAX APPEAL(111) | `ITA` | Income Tax Appeal |
| `LPA` | LETTERS PATENT APPEAL(1) | `LPA` | Letters Patent Appeal |
| `PIL` | PUBLIC INTEREST LITIGATION(153) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `WP(C)PIL` | PUBLIC INTEREST LITIGATION -DB(320) | `WP_C_PIL` | Writ Petition (Public Interest Litigation) |
| `RPC` | REVIEW PETITIONS (CIVIL)(27) | `RP_C` | Review Petition (Civil) |
### Jharkhand High Court — Ranchi

- **benchId:** `21` · **local types:** 64
- **Exact:** 14 · **Suggested:** 2 · **Review:** 3 · **Conflict:** 4 · **No eCourts type:** 41
- **Writ-related maps:** `Cr.WJC` → `CR_WJC`, `CWJC` → `—`, `WPC` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CWJC` (CWJC(CIVIL WRIT)(15)), `MJC` (MISCELLANEOUS JURISDICTION CASES(10)), `MA` (MISCELLENOUS APPEAL(2)), `SCA` (SUPREME COURT APPEAL(40))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `LPA` | LETTER PATENTS APPEAL(3) | `LPA` | Letters Patent Appeal |
| `WPC` | WRIT PETITIONS(50) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `A.B.A.` | ANTICIPATORY BAIL(57) | `ABA` | Anticipatory Bail Application |
| `C.Rev.` | CIVIL REVIEW(11) | `C_REV` | Civil Revision |
| `C.R.` | CIVIL REVISION(8) | `CR` | Civil Revision (short form) |
| `C.A.` | COMPANY APPEAL(20) | `CA` | Civil Appeal |
| `Cr.Misc.` | CRIMINAL MISCELLENOUS(6) | `CR_MISC` | Criminal Miscellaneous |
| `Cr.Rev.` | CRIMINAL REVISION(7) | `CR_REV` | Criminal Revision |
| `C.O.` | CROSS OBJECTIONS(52) | `CO` | Cross Objection |
| `Cr.WJC` | Cr.WJC(CRIMINAL WRIT)(16) | `CR_WJC` | Criminal Writ Jurisdiction Case |
| `D. Ref.` | DEATH REFERENCE(28) | `DREF` | Death Reference |
| `E.P.` | ELECTION PETITION(14) | `EP` | Election Petition |
| `FA` | FIRST APPEAL(1) | `FA` | First Appeal |
| `B.A.` | REGULAR BAIL(56) | `BA` | Bail Application |
| `SA` | SECOND APPEAL(9) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `T.S.` | TESTAMENTARY SUIT(22) | `TS` | Testamentary Suit |
### Karnataka High Court — Bengaluru

- **benchId:** `22` · **local types:** 72
- **Exact:** 13 · **Suggested:** 10 · **Review:** 18 · **Conflict:** 0 · **No eCourts type:** 31
- **Writ-related maps:** `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | Central Excise Appeal | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CP` | Civil Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `COM.S` | Commercial Suit | `COM_S` | Commercial Suit |
| `CRL.A` | Criminal Appeal | `CRL_A` | Criminal Appeal |
| `CRL.P` | Criminal Petition | `CRLP` | Criminal Leave Petition |
| `CRA` | CROSS APPEALS | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CROB` | Cross Objection | `CO, XOBJ` | Cross Objection | Cross Objection |
| `CSTA` | Customs Appeal | `CU_CESTAT` | Customs Appeal |
| `TRC` | Tax referred cases | `Tax_Ref` | Tax Reference Case |
| `WP` | Writ Petition | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRP` | Civil Revision Petition | `CRP` | Civil Revision Petition |
| `COP` | Company Petition | `COP` | Company Petition |
| `CRL.RC` | Criminal Referred Case | `CRLRC` | Criminal Revision Case |
| `EP` | Election Petition | `EP` | Election Petition |
| `GTA` | Gift Tax Appeal | `GTA` | Gift Tax Appeal |
| `ITA` | Income Tax Appeal | `ITA` | Income Tax Appeal |
| `MFA` | Miscellaneous First Appeal | `MFA` | Miscellaneous First Appeal |
| `OS` | Original Suit | `OS` | Original Suit |
| `RFA` | Regular First Appeal | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Regular Second Appeal | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `STA` | Sales Tax Appeal | `STA` | Sur Tax Appeal |
| `WTA` | Wealth Tax Appeal | `WTA` | Wealth Tax Appeal |
| `WA` | Writ Appeal | `WA` | Writ Appeal |
### Karnataka High Court — Dharwad

- **benchId:** `23` · **local types:** 72
- **Exact:** 13 · **Suggested:** 10 · **Review:** 18 · **Conflict:** 0 · **No eCourts type:** 31
- **Writ-related maps:** `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | Central Excise Appeal | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CP` | Civil Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `COM.S` | Commercial Suit | `COM_S` | Commercial Suit |
| `CRL.A` | Criminal Appeal | `CRL_A` | Criminal Appeal |
| `CRL.P` | Criminal Petition | `CRLP` | Criminal Leave Petition |
| `CRA` | CROSS APPEALS | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CROB` | Cross Objection | `CO, XOBJ` | Cross Objection | Cross Objection |
| `CSTA` | Customs Appeal | `CU_CESTAT` | Customs Appeal |
| `TRC` | Tax referred cases | `Tax_Ref` | Tax Reference Case |
| `WP` | Writ Petition | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRP` | Civil Revision Petition | `CRP` | Civil Revision Petition |
| `COP` | Company Petition | `COP` | Company Petition |
| `CRL.RC` | Criminal Referred Case | `CRLRC` | Criminal Revision Case |
| `EP` | Election Petition | `EP` | Election Petition |
| `GTA` | Gift Tax Appeal | `GTA` | Gift Tax Appeal |
| `ITA` | Income Tax Appeal | `ITA` | Income Tax Appeal |
| `MFA` | Miscellaneous First Appeal | `MFA` | Miscellaneous First Appeal |
| `OS` | Original Suit | `OS` | Original Suit |
| `RFA` | Regular First Appeal | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Regular Second Appeal | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `STA` | Sales Tax Appeal | `STA` | Sur Tax Appeal |
| `WTA` | Wealth Tax Appeal | `WTA` | Wealth Tax Appeal |
| `WA` | Writ Appeal | `WA` | Writ Appeal |
### Karnataka High Court — Kalaburagi

- **benchId:** `24` · **local types:** 72
- **Exact:** 13 · **Suggested:** 10 · **Review:** 17 · **Conflict:** 0 · **No eCourts type:** 32
- **Writ-related maps:** `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | Central Excise Appeal | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CP` | Civil Petition | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `COM.S` | Commercial Suit | `COM_S` | Commercial Suit |
| `CRL.A` | Criminal Appeal | `CRL_A` | Criminal Appeal |
| `CRL.P` | Criminal Petition | `CRLP` | Criminal Leave Petition |
| `CRA` | CROSS APPEALS | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CROB` | Cross Objection | `CO, XOBJ` | Cross Objection | Cross Objection |
| `CSTA` | Customs Appeal | `CU_CESTAT` | Customs Appeal |
| `TRC` | Tax referred cases | `Tax_Ref` | Tax Reference Case |
| `WP` | Writ Petition | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRP` | Civil Revision Petition | `CRP` | Civil Revision Petition |
| `COP` | Company Petition | `COP` | Company Petition |
| `CRL.RC` | Criminal Referred Case | `CRLRC` | Criminal Revision Case |
| `EP` | Election Petition | `EP` | Election Petition |
| `GTA` | Gift Tax Appeal | `GTA` | Gift Tax Appeal |
| `ITA` | Income Tax Appeal | `ITA` | Income Tax Appeal |
| `MFA` | Miscellaneous First Appeal | `MFA` | Miscellaneous First Appeal |
| `OS` | Original Suit | `OS` | Original Suit |
| `RFA` | Regular First Appeal | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Regular Second Appeal | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `STA` | Sales Tax Appeal | `STA` | Sur Tax Appeal |
| `WTA` | Wealth Tax Appeal | `WTA` | Wealth Tax Appeal |
| `WA` | Writ Appeal | `WA` | Writ Appeal |
### Kerala High Court — Kochi

- **benchId:** `25` · **local types:** 75
- **Exact:** 13 · **Suggested:** 7 · **Review:** 3 · **Conflict:** 4 · **No eCourts type:** 48
- **Writ-related maps:** `WA` → `WA`, `WP` → `WP_C, WP_CRL`, `WPHC` → `HCP`
- **Code conflicts (do not send local code as eCourts facet):** `CC` (CIA)(Criminal Complaint (Commissions of Inquiry Act)-(169)), `CA` (Company Application-(101)), `MFA` (Miscl. First Appeal-(124)), `RA` (Regular Appeal-(153))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | Central Excise Appeal-(104) | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CP` | Civil Petition-(106) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRL.A` | Criminal Appeal-(110) | `CRL_A` | Criminal Appeal |
| `CRL.P` | Criminal Petition-(112) | `CRLP` | Criminal Leave Petition |
| `CRA` | CROSS APPEALS-(160) | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `TRC` | Tax referred cases-(142) | `Tax_Ref` | Tax Reference Case |
| `WP` | Writ Petition-(144) | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRP` | Civil Revision Petition-(108) | `CRP` | Civil Revision Petition |
| `COM.S` | Commercial Suit-(177) | `COM_S` | Commercial Suit |
| `COP` | Company Petition-(102) | `COP` | Company Petition |
| `CRL.RC` | Criminal Referred Case-(113) | `CRLRC` | Criminal Revision Case |
| `EP` | Election Petition-(116) | `EP` | Election Petition |
| `GTA` | Gift Tax Appeal-(148) | `GTA` | Gift Tax Appeal |
| `ITA` | Income Tax Appeal-(120) | `ITA` | Income Tax Appeal |
| `OS` | Original Suit-(154) | `OS` | Original Suit |
| `RFA` | Regular First Appeal-(132) | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Regular Second Appeal-(136) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SA` | Second Appeal-(174) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | Wealth Tax Appeal-(149) | `WTA` | Wealth Tax Appeal |
| `WA` | Writ Appeal-(145) | `WA` | Writ Appeal |
### Madhya Pradesh High Court — Gwalior

- **benchId:** `27` · **local types:** 104
- **Exact:** 13 · **Suggested:** 14 · **Review:** 15 · **Conflict:** 4 · **No eCourts type:** 58
- **Writ-related maps:** `CMWP` → `WP_C`, `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `FEMA` (FORIEGN EXCHANGE MANAGEMENT APPEAL), `MFA` (MISCALLENEOUS FIRST APPREAL), `MA` (MISC. APPEAL), `RC` (REVIEW CASE)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `ARBA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEAL | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CMAPL` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMA(R)` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMAP(R)` | CIVIL MISCELLANEOUS APPLICATION | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `COMP` | COMPANY PETITION | `COP` | Company Petition |
| `CONT` | CONTEMPT. PETITION | `CONMT` | Contempt Petition |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRMA` | CRIMINAL MISCELLANEOUS APPLICATION | `MCrA` | Miscellaneous Criminal Application |
| `CRMC` | CRIMINAL MISCELLANEOUS CASE | `CR_MISC` | Criminal Miscellaneous |
| `DR` | DEATH REFERENCE | `DREF` | Death Reference |
| `TR` | TAX REFERENCE | `Tax_Ref` | Tax Reference Case |
| `WP` | WRIT PETITION | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPLICATION | `CMA, CMAppl, MA` | Civil Miscellaneous Appeal | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CREV` | CIVIL REVIEW | `C_REV` | Civil Revision |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `CRP` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CS` | CIVIL SUIT | `CS` | Civil Suit |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `FA` | FIRST APPEAL | `FA` | First Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
| `WA` | WRIT APPEAL | `WA` | Writ Appeal |
### Madhya Pradesh High Court — Indore

- **benchId:** `28` · **local types:** 104
- **Exact:** 13 · **Suggested:** 14 · **Review:** 15 · **Conflict:** 4 · **No eCourts type:** 58
- **Writ-related maps:** `CMWP` → `WP_C`, `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `FEMA` (FORIEGN EXCHANGE MANAGEMENT APPEAL), `MFA` (MISCALLENEOUS FIRST APPREAL), `MA` (MISC. APPEAL), `RC` (REVIEW CASE)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `ARBA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEAL | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CMAPL` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMA(R)` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMAP(R)` | CIVIL MISCELLANEOUS APPLICATION | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `COMP` | COMPANY PETITION | `COP` | Company Petition |
| `CONT` | CONTEMPT. PETITION | `CONMT` | Contempt Petition |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRMA` | CRIMINAL MISCELLANEOUS APPLICATION | `MCrA` | Miscellaneous Criminal Application |
| `CRMC` | CRIMINAL MISCELLANEOUS CASE | `CR_MISC` | Criminal Miscellaneous |
| `DR` | DEATH REFERENCE | `DREF` | Death Reference |
| `TR` | TAX REFERENCE | `Tax_Ref` | Tax Reference Case |
| `WP` | WRIT PETITION | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPLICATION | `CMA, CMAppl, MA` | Civil Miscellaneous Appeal | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CREV` | CIVIL REVIEW | `C_REV` | Civil Revision |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `CRP` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CS` | CIVIL SUIT | `CS` | Civil Suit |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `FA` | FIRST APPEAL | `FA` | First Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
| `WA` | WRIT APPEAL | `WA` | Writ Appeal |
### Madhya Pradesh High Court — Jabalpur

- **benchId:** `26` · **local types:** 104
- **Exact:** 13 · **Suggested:** 14 · **Review:** 15 · **Conflict:** 4 · **No eCourts type:** 58
- **Writ-related maps:** `CMWP` → `WP_C`, `WA` → `WA`, `WP` → `WP_C, WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `FEMA` (FORIEGN EXCHANGE MANAGEMENT APPEAL), `MFA` (MISCALLENEOUS FIRST APPREAL), `MA` (MISC. APPEAL), `RC` (REVIEW CASE)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `ARBA` | ARBITRATION APPEAL | `ARB_A` | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEAL | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CMAPL` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMA(R)` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CMAP(R)` | CIVIL MISCELLANEOUS APPLICATION | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `COMP` | COMPANY PETITION | `COP` | Company Petition |
| `CONT` | CONTEMPT PETITION | `CONMT` | Contempt Petition |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRMA` | CRIMINAL MISCELLANEOUS APPLICATION | `MCrA` | Miscellaneous Criminal Application |
| `CRMC` | CRIMINAL MISCELLANEOUS CASE | `CR_MISC` | Criminal Miscellaneous |
| `DR` | DEATH REFERENCE | `DREF` | Death Reference |
| `TR` | TAX REFERENCE | `Tax_Ref` | Tax Reference Case |
| `WP` | WRIT PETITION | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPLICATION | `CMA, CMAppl, MA` | Civil Miscellaneous Appeal | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CREV` | CIVIL REVIEW | `C_REV` | Civil Revision |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `CRP` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CS` | CIVIL SUIT | `CS` | Civil Suit |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `FA` | FIRST APPEAL | `FA` | First Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
| `WA` | WRIT APPEAL | `WA` | Writ Appeal |
### Madras High Court — Chennai

- **benchId:** `29` · **local types:** 169
- **Exact:** 8 · **Suggested:** 14 · **Review:** 27 · **Conflict:** 3 · **No eCourts type:** 117
- **Writ-related maps:** `REV.APLWP Crl.` → `WP_CRL`, `WA` → `WA`, `WA(MD)` → `WA`, `WPMP Crl.` → `WP_CRL`, `WPMP Crl.(MD)` → `WP_CRL`, `WP` → `WP_C, WP_CRL`, `WP Crl.` → `WP_CRL`, `WP Crl. (MD)` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `IA` (INSOLVENCY APPLICATION), `RC` (REFERRED CASES), `STA` (SPECIAL TRIBUNAL APPEAL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb Appeal` | Arbitration Appeal | `ARB_A` | Arbitration Appeal |
| `CS` | CIVIL SUITS | `CS` | Civil Suit |
| `CP` | COMPANY PETITION | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CONT P` | CONTEMPT PETITION | `CONMT` | Contempt Petition |
| `CRL A` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRL RC` | CRIMINAL REVISION CASE | `CRLRC, CR_REV` | Criminal Revision Case | Criminal Revision |
| `CROS.OBJ` | CROSS OBJECTION | `CO, XOBJ` | Cross Objection | Cross Objection |
| `ELP` | ELECTION PETITION | `EP` | Election Petition |
| `EP` | EXECUTION PETITION | `EP` | Election Petition |
| `AS` | FIRST APPEAL | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `OP` | ORIGINAL PETITION | `OMP` | Original Miscellaneous Petition |
| `TCR` | TAX CASE REFERENCE | `Tax_Ref` | Tax Reference Case |
| `WP` | WRIT PETITION | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |
| `WP Crl.` | Writ Petition Criminal | `WP_CRL` | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISC. APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CRP` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `(CR) A` | COPY RIGHTS APPLICATION | `CRA` | Criminal Appeal (DC) |
| `HCP` | HABEAS CORPUS PETITION | `HCP` | Habeas Corpus Petition |
| `IP` | INSOLVENCY PETITION | `IP` | Insolvency Petition |
| `LPA` | LETTERS PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WA` | WRIT APPEAL | `WA` | Writ Appeal |
### Madras High Court — Madurai

- **benchId:** `30` · **local types:** 124
- **Exact:** 6 · **Suggested:** 4 · **Review:** 6 · **Conflict:** 0 · **No eCourts type:** 108
- **Writ-related maps:** `WA` → `WA`, `WPMP Crl.` → `WP_CRL`, `WP` → `WP_C, WP_CRL`, `WP Crl.` → `WP_CRL`, `WP Crl.(MD)` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `AS` | Appeal Suit(1) | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `CRL A` | Criminal Appeal(273) | `CRL_A` | Criminal Appeal |
| `CRL RC` | CRIMINAL REVISION CASE(13) | `CRLRC` | Criminal Revision Case |
| `WP` | WRIT PETITION(49) | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPEAL(2) | `CMA` | Civil Miscellaneous Appeal |
| `CRP` | CIVIL REVISION PETITION(12) | `CRP` | Civil Revision Petition |
| `HCP` | HABEAS CORPUS PETITION(22) | `HCP` | Habeas Corpus Petition |
| `SA` | SECOND APPEAL(38) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WA` | WRIT APPEAL(48) | `WA` | Writ Appeal |
| `WP Crl.` | Writ Petition Criminal(334) | `WP_CRL` | Writ Petition (Criminal) |
### Manipur High Court — Imphal

- **benchId:** `31` · **local types:** 218
- **Exact:** 14 · **Suggested:** 7 · **Review:** 16 · **Conflict:** 4 · **No eCourts type:** 177
- **Writ-related maps:** `W.P.(Crl.)` → `WP_CRL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WA` → `WA`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CR` (Civil Rule(161)), `CO` (Cross Objection in First Appeal(23)), `MFA` (First Appeal against judgments in Special Jurisdiction cases.(68)), `IA` (Interiocutory applications in pending Suits/Appeals(32))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal against Judgment/Sentence.(88) | `CRL_A` | Criminal Appeal |
| `ITA` | Application under Section 256(2)(71) | `ITA` | Income Tax Appeal |
| `RFA` | First Appeal from Judgment Decree in Suit(22) | `RFA, FA` | Regular First Appeal | First Appeal |
| `LPA` | Latters Patent Appeal(187) | `LPA` | Letters Patent Appeal |
| `SCLP` | Petition for Leave to Appeal to Supreme Court(37) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `RSA` | Second Appeal from Judgment Decree(25) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `WP(C)` | Writ Petition under Article 226 of the Constitution(35) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A` | Appeals under Indian Arbitration Act.(63) | `ARB_A` | Arbitration Appeal |
| `CAV` | Caveat(153) | `CAV` | Caveat |
| `CREV` | Civil Revision(172) | `C_REV` | Civil Revision |
| `CS` | Civil Suit(21) | `CS` | Civil Suit |
| `CRREV` | Criminal Revision(179) | `CR_REV` | Criminal Revision |
| `FA` | First Appeal(181) | `FA` | First Appeal |
| `CMAppl.` | Misc Applications eg Leave to Sue as indigent person restoration application condonat(33) | `CMAppl` | Civil Miscellaneous Application |
| `MC(OC)` | Misc. Case of Original Case(107) | `MCOC` | Motor Vehicle Compensation Case |
| `W.P.(Crl.)` | Petition under Art226 for Writ and Habeas Corpus and other relief in relation to a Crimina(95) | `WP_CRL` | Writ Petition (Criminal) |
| `PIL` | Public Interest Litigation(36) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `CRP` | Revision Petition(27) | `CRP` | Civil Revision Petition |
| `SA` | Second Appeal(200) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `RCSA` | Second Appeal(54) | `RCS_A` | Regular Civil Suit - Class A |
| `WA` | Writ Appeal(203) | `WA` | Writ Appeal |
### Meghalaya High Court — Shillong

- **benchId:** `32` · **local types:** 226
- **Exact:** 11 · **Suggested:** 11 · **Review:** 12 · **Conflict:** 10 · **No eCourts type:** 182
- **Writ-related maps:** `W.P.` → `WP_C, WP_CRL`, `MC(WPC)` → `WP_C`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (Appeal Under The Companies Act 1956-(187)), `IP` (Appl.)(Application Submitted After Adjudication-(137)), `CR` (Civil Rule-(1)), `CC` (CIV)[SH](Contempt Of Court  Civil-(7)), `CO` (Cross Objection In First Appeal.-(97)), `IA` (Interlocutory Applications In Pending Suits Appeals-(108)), `MFA` (Mfa-(144)), `RA` (Review Application-(70))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal Against Judgment Sentence-(166) | `CRL_A` | Criminal Appeal |
| `WA` | Appeal Before Division Bench Against Judgment Or Order Of Single Judge-(112) | `WA` | Writ Appeal |
| `ITA` | Application Under Section 256 2-(148) | `ITA` | Income Tax Appeal |
| `CP` | Condonation Petition-(68) | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `W.P.` | Crl.)(Writ And Habeas Corpus And Other Relief In Relation To A Criminal Pro-(173) | `WP_C, WP_CRL` | Writ Petition (Civil) | Writ Petition (Criminal) |
| `RFA` | First Appeal Fron Judgment And Decree In Suit-(96) | `RFA, FA` | Regular First Appeal | First Appeal |
| `LPA` | Latters Patent Appeal-(23) | `LPA` | Letters Patent Appeal |
| `SCLP` | Petition For Leave To Appeal To Supreme Court-(113) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `RSA` | Second Appeal From Judgment And Decree-(99) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SLP` | Special Leave Petition-(203) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `WP(C)` | Writ Petition Under Article 226 And 227 Of The Constitution-(111) | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals Under Indian Arbitration Act.-(139) | `ARB_A` | Arbitration Appeal |
| `BA` | Bail Application-(57) | `BA` | Bail Application |
| `CREV` | Civil Revision-(14) | `C_REV` | Civil Revision |
| `CS` | Civil Suit-(95) | `CS` | Civil Suit |
| `FA` | First Appeal-(18) | `FA` | First Appeal |
| `MC(RA)` | Misc. Case  In R.a.-(85) | `MCrA` | Miscellaneous Criminal Application |
| `CMAppl.` | Miscelleneous Applications-(109) | `CMAppl` | Civil Miscellaneous Application |
| `PIL` | Public Interest Litigation-(93) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `CRP` | Revision Petition-(102) | `CRP` | Civil Revision Petition |
| `RCSA` | Second Appeal-(130) | `RCS_A` | Regular Civil Suit - Class A |
| `SA` | Second Appeal.-(39) | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Orissa High Court — Cuttack

- **benchId:** `33` · **local types:** 160
- **Exact:** 10 · **Suggested:** 15 · **Review:** 2 · **Conflict:** 8 · **No eCourts type:** 125
- **Writ-related maps:** `WPCRL` → `WP_CRL`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CO` (CO-Cross Objections in First Appeal. - (14)), `EDA` (EDA-Appl.for reference under Estate Duty Act - (46)), `GTA` (GTA-Appl.for reference under Gift Tax Act. - (60)), `IA` (IA-Interlocutory Appl. in suits/appeals. - (63)), `MA` (MA-Miscellaneous Appeals - (80)), `MFA` (MFA-FA against Spl. Jurisdiction Cases. - (86)), `MJC` (MJC-Misc.Judicial Case. - (87)), `SCA` (SCA-Supreme Court Appeal. - (110))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARBP` | ARBP-Petitions under Arbitration and Conciliation Act - (4) | `ARB_PET, Arb_Pet` | Arbitration Petition (uppercase variant) | Arbitration Petition |
| `AS` | AS-Admirality Suit. - (5) | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `CRA` | CRA-Criminal Appeals - (23) | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRLA` | CRLA-Appeal against Judgement/Sentence. - (24) | `CRL_A` | Criminal Appeal |
| `CRP` | CRP-Revision Petition. - (33) | `CRP` | Civil Revision Petition |
| `ITA` | ITA-Appeals Income-tax - (69) | `ITA` | Income Tax Appeal |
| `LPA` | LPA-Letters Patent Appeals. - (79) | `LPA` | Letters Patent Appeal |
| `MACA` | MACA-Motor Accident Appeals. - (82) | `MACA, MA_CA` | Motor Accident Claims Appeal | Miscellaneous Application (Companies Act) |
| `RFA` | RFA-FA from Judgement and Decree in Suit - (104) | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | RSA-Second Appeal from Judgement and Decree. - (106) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `SCLP` | SCLP-Pet.for leave to appeal to Supreme Court - (111) | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `WA` | WA-Appeals before DB against SB Judgement - (125) | `WA` | Writ Appeal |
| `WPCRL` | WPCRL-Pet.UA.226 for Writ of Habeas Corpus. - (127) | `WP_CRL` | Writ Petition (Criminal) |
| `WP(C)` | WP(C)-Writ Petition under Art.226 and 227. - (126) | `WP_C` | Writ Petition (Civil) |
| `WTA` | WTA-Appl.for reference under Wealth Tax Act. - (128) | `WTA` | Wealth Tax Appeal |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARBA` | ARBA-Appeals under Arbitration Conciliation Act - (3) | `ARB_A` | Arbitration Appeal |
| `CRLMA` | CRLMA-Other Miscellaneous Application. - (26) | `CRL_MA` | Criminal Miscellaneous Application (DC) |
| `CRREV` | CRREV-Criminal Revision - (35) | `CR_REV` | Criminal Revision |
| `CS` | CS-Civil Suit - (36) | `CS` | Civil Suit |
| `DREF` | DREF-Death Reference. - (43) | `DREF` | Death Reference |
| `EP` | EP-Election Petition Case. - (50) | `EP` | Election Petition |
| `FA` | FA-First Appeal - (55) | `FA` | First Appeal |
| `OS` | OS-Original Suit. - (95) | `OS` | Original Suit |
| `RCSA` | RCSA-Second Appeals(Rent Control Matters) - (103) | `RCS_A` | Regular Civil Suit - Class A |
| `SA` | SA-Second Appeal - (108) | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Patna High Court — Patna

- **benchId:** `34` · **local types:** 45
- **Exact:** 6 · **Suggested:** 9 · **Review:** 5 · **Conflict:** 2 · **No eCourts type:** 23
- **Writ-related maps:** `CWJC` → `CWJC`, `CR. WJC` → `CR_WJC`
- **Code conflicts (do not send local code as eCourts facet):** `MJC` (Miscellaneous Jurisdiction Case), `SCA` (SUPREME COURT APPEAL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `C.R.` | CIVIL REVISION | `C_REV, CR` | Civil Revision | Civil Revision (short form) |
| `COMP PET` | COMPANY PETITION | `COP` | Company Petition |
| `CR. MISC.` | CRIMINAL MISCELLANEOUS | `CR_MISC` | Criminal Miscellaneous |
| `CR. REV.` | CRIMINAL REVISION | `CR_REV, CRLRC` | Criminal Revision | Criminal Revision Case |
| `CR. WJC` | Criminal Writ Jurisdiction Case | `CR_WJC` | Criminal Writ Jurisdiction Case |
| `D. REF.` | DEATH REFERENCE | `DREF` | Death Reference |
| `E.P.` | ELECTION PETITION | `EP` | Election Petition |
| `L.P.A` | Letters Patent Appeal | `LPA` | Letters Patent Appeal |
| `SLP` | SPECIAL LEAVE PETITION | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `C. REV.` | CIVIL REVIEW | `C_REV` | Civil Revision |
| `CWJC` | Civil Writ Jurisdiction Case | `CWJC` | Civil Writ Jurisdiction Case |
| `COMP. APP` | COMPANY APPEAL | `COMP_APP` | Compensation Application |
| `FA` | FIRST APPEAL | `FA` | First Appeal |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `T.S.` | TITLE SUIT | `TS` | Testamentary Suit |
### Punjab and Haryana High Court — Chandigarh

- **benchId:** `35` · **local types:** 131
- **Exact:** 15 · **Suggested:** 13 · **Review:** 25 · **Conflict:** 3 · **No eCourts type:** 75
- **Writ-related maps:** `CWP` → `WP_C`, `CWP-COM` → `WP_C`, `CWP-PIL` → `WP_C_PIL, WP_PIL`, `CA-CWP` → `WA`, `CRWP` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** `CO` (CIVIL ORIGINAL), `EA` (EXECUTION APPL.), `RA` (REVIEW APPL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CEA` | CENTRAL EXCEISE APPEAL (WEF 10-11-2003) | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `CWP` | CIVIL WRIT PETITION | `WP_C` | Writ Petition (Civil) |
| `CMA` | COMPANY MISC. APPLICATION | `CMA` | Civil Miscellaneous Appeal |
| `CP` | COMPANY PETITIONS | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRA` | CRIMINAL APPEAL | `CRL_A, CRA` | Criminal Appeal | Criminal Appeal (DC) |
| `CRWP` | CRIMINAL WRIT PETITION | `WP_CRL` | Writ Petition (Criminal) |
| `EP` | ELECTION PETITIONS | `EP` | Election Petition |
| `EDC` | ESTATE DUTY CASE | `EDA` | Estate Duty Appeal |
| `GTC` | GIFT TAX CASE | `GTA` | Gift Tax Appeal |
| `ITC` | INCOME TAX CASES | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |
| `RERA-APPL` | RERA APPEAL | `RERA` | RERA Appeal |
| `SA` | SERVICE APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `TCRM` | TRANSFER CRIMINAL PETITION | `TP_CRL` | Transfer Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARB` | ARBITRATION ACT CASE (WEF 15/10/03) | `Arb` | Arbitration Case (DC) |
| `CA` | CIVIL APPEAL/COMPANY APPLICATION | `CA` | Civil Appeal |
| `CR` | CIVIL REVISION | `CR, C_REV` | Civil Revision (short form) | Civil Revision |
| `CS` | CIVIL SUIT | `CS` | Civil Suit |
| `CRR` | CRIMINAL REVISION | `CRR, CR_REV, CRLRC` | Criminal Revision (DC) | Criminal Revision | Criminal Revision Case |
| `XOBJ` | CROSS OBJECTION | `XOBJ, CO` | Cross Objection | Cross Objection |
| `GTA` | GIFT TAX APPEAL | `GTA` | Gift Tax Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `INTTA` | INTEREST TAX APPEAL | `INTTA` | Interest Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `RFA` | REGULAR FIRST APPEAL | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | REGULAR SECOND APPEAL | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `RA-CA` | REVIEW IN COMPANY APPEAL | `RA_CA` | Restoration Application (Companies Act) |
| `STA` | SALES TAX APPEAL | `STA` | Sur Tax Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
### Rajasthan High Court — Jaipur

- **benchId:** `37` · **local types:** 94
- **Exact:** 6 · **Suggested:** 8 · **Review:** 35 · **Conflict:** 1 · **No eCourts type:** 44
- **Writ-related maps:** `CW` → `WP_C`, `CRLW` → `WP_CRL`, `XOBJW` → `CO, XOBJ`, `SAW` → `WA`, `WCP` → `CONMT`, `WRES` → `REST_APP`
- **Code conflicts (do not send local code as eCourts facet):** `EA` (ELECTION APPLICATION)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMAP` | CIVIL MISCELLANEOUS APPLICATION | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `CRW` | CIVIL REVIEW PETITION | `RP_C` | Review Petition (Civil) |
| `CR` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CW` | CIVIL WRIT PETITION | `WP_C` | Writ Petition (Civil) |
| `CRLA` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRLMA` | CRIMINAL MISCELLANEOUS APPLICATION | `MCrA, CRL_MA` | Miscellaneous Criminal Application | Criminal Miscellaneous Application (DC) |
| `CRLW` | CRIMINAL WRIT PETITION | `WP_CRL` | Writ Petition (Criminal) |
| `HC` | HABEAS CORPUS PETITION | `HCP` | Habeas Corpus Petition |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `COP` | COMPANY PETITION | `COP` | Company Petition |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `GTA` | GIFT TAX APPEAL | `GTA` | Gift Tax Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
### Rajasthan High Court — Jodhpur

- **benchId:** `36` · **local types:** 118
- **Exact:** 8 · **Suggested:** 8 · **Review:** 23 · **Conflict:** 2 · **No eCourts type:** 77
- **Writ-related maps:** `CW` → `WP_C`, `CRLW` → `WP_CRL`, `XOBJW` → `CO, XOBJ`
- **Code conflicts (do not send local code as eCourts facet):** `EA` (ELECTION APPLICATION), `IA` (INTERLOCUTORY APPLI.)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRW` | CIVIL REVIEW PETITION | `RP_C` | Review Petition (Civil) |
| `CR` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CW` | CIVIL WRIT PETITION | `WP_C` | Writ Petition (Civil) |
| `CRLA` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRLW` | CRIMINAL WRIT PETITION | `WP_CRL` | Writ Petition (Criminal) |
| `EDC` | ESTATE DUTY CASES | `EDA` | Estate Duty Appeal |
| `HC` | HABEAS CORPUS PETITION | `HCP` | Habeas Corpus Petition |
| `ITC` | INCOME TAX CASES | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISC. APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `COP` | COMPANY PETITION | `COP` | Company Petition |
| `CRLMA` | CRIMINAL MISC. APPLI | `CRL_MA` | Criminal Miscellaneous Application (DC) |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `GTA` | GIFT TAX APPEAL | `GTA` | Gift Tax Appeal |
| `ITA` | INCOME TAX APPEAL | `ITA` | Income Tax Appeal |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
### Sikkim High Court — Gangtok

- **benchId:** `38` · **local types:** 40
- **Exact:** 4 · **Suggested:** 4 · **Review:** 4 · **Conflict:** 1 · **No eCourts type:** 27
- **Writ-related maps:** `WA` → `WA`, `WP(Crl.)` → `WP_CRL`, `WP(PIL)` → `WP_PIL, WP_C_PIL, PIL`
- **Code conflicts (do not send local code as eCourts facet):** `CO` (Cross Objection In First Appeal-(3))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl. A.` | Criminal Appeal-(21) | `CRL_A` | Criminal Appeal |
| `RFA` | First Appeal From Judgment And Decree In Suit-(1) | `RFA, FA` | Regular First Appeal | First Appeal |
| `RSA` | Second Appeal From Judgment And Decree-(4) | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `WP(PIL)` | Writ Petition Pil-(26) | `WP_PIL, WP_C_PIL, PIL` | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) | Public Interest Litigation |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals Under Indian Arbiration Act-(16) | `ARB_A` | Arbitration Appeal |
| `CRP` | Revision Petition-(6) | `CRP` | Civil Revision Petition |
| `WA` | Writ Appeal-(36) | `WA` | Writ Appeal |
| `WP(Crl.)` | Writ Petition Criminal-(20) | `WP_CRL` | Writ Petition (Criminal) |
### Supreme Court — Supreme Court

- **benchId:** `42` · **local types:** 34
- **Exact:** 1 · **Suggested:** 15 · **Review:** 8 · **Conflict:** 0 · **No eCourts type:** 10
- **Writ-related maps:** `SMW(C)` → `WP_C`, `SMW(Crl)` → `WP_CRL`, `W.P.(C)` → `WP_C`, `W.P.(Crl.)` → `WP_CRL`
- **Code conflicts (do not send local code as eCourts facet):** none

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ARBIT.PETITON` | ARBITRATION PETITION | `Arb_Pet` | Arbitration Petition |
| `C.A.` | CIVIL APPEAL | `CA` | Civil Appeal |
| `Crl.A.` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `D.REF.` | DEATH REFERENCE CASE | `DREF` | Death Reference |
| `ORGNL.SUIT` | ORIGINAL SUIT | `OS` | Original Suit |
| `R.P.(C)` | REVIEW PETITION (CIVIL) | `RP_C` | Review Petition (Civil) |
| `R.P.(Crl.)` | REVIEW PETITION (CRIMINAL) | `RP_CRL` | Review Petition (Criminal) |
| `SLP(C)` | SPECIAL LEAVE TO PETITION (CIVIL) | `SLP_C` | Special Leave Petition (Civil) |
| `SLP(Crl)` | SPECIAL LEAVE TO PETITION (CRIMINAL) | `SLP_CRL` | Special Leave Petition (Criminal) |
| `SPL.REF.` | SPECIAL REFERENCE CASE | `Special_Ref` | Special Reference Case |
| `T.REF` | TAX REFERENCE CASE | `Tax_Ref` | Tax Reference Case |
| `T.P.(C)` | TRANSFER PETITION (CIVIL) | `TP_C` | Transfer Petition (Civil) |
| `T.P.(Crl.)` | TRANSFER PETITION (CRIMINAL) | `TP_CRL` | Transfer Petition (Criminal) |
| `W.P.(C)` | WRIT TO PETITION (CIVIL) | `WP_C` | Writ Petition (Civil) |
| `W.P.(Crl.)` | WRIT TO PETITION (CRIMINAL) | `WP_CRL` | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `MA` | MISCELLANEOUS APPLICATION | `MA` | Miscellaneous Application (Civil) |
### Telangana High Court — Hyderabad

- **benchId:** `39` · **local types:** 91
- **Exact:** 11 · **Suggested:** 31 · **Review:** 8 · **Conflict:** 4 · **No eCourts type:** 37
- **Writ-related maps:** `WP(PIL)` → `PIL, WP_PIL, WP_C_PIL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `SUOMOTUWP` → `WP_C`, `SUOMOTUWP(PIL)` → `WP_PIL, WP_C_PIL`, `TUPWP(PIL)` → `WP_PIL, WP_C_PIL`, `TUPWP` → `WP_C`, `WA` → `WA`, `WA X-OBJ` → `CO, XOBJ`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (CONTEMPT APPEAL), `CC` (CONTEMPT CASE), `RC` (REFERRED CASE), `STA` (SPECIAL TRIBUNAL APPEAL)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `APPL` | APPLICATION IN CIVIL SUIT | `CMAppl, MA` | Civil Miscellaneous Application | Miscellaneous Application (Civil) |
| `ARBAPPL` | ARBITRATION APPLICATION | `ARB_PET, Arb_Pet, ARB_A` | Arbitration Petition (uppercase variant) | Arbitration Petition | Arbitration Appeal |
| `CEA` | CENTRAL EXCISE APPEALS | `EX_CESTAT, CESTAT_APPEAL` | Excise Appeal | CESTAT Appeal |
| `COMS` | COMMERCIAL SUIT | `COM_S` | Commercial Suit |
| `CAPPEAL` | COMPANY APPEAL | `CAPP_CA, CAPP_AT` | Company Appeal (Companies Act) | Company Appeal (AT) |
| `CP` | COMPANY PETITION | `COP, CP_CA` | Company Petition | Company Petition (Companies Act) |
| `CRLA` | CRIMINAL APPEAL | `CRL_A` | Criminal Appeal |
| `CRLA(FSSA)` | CRIMINAL APPEAL(Food Safety and Standard Act) | `CRL_A` | Criminal Appeal |
| `CRLATR` | CRIMINAL APPEAL TRANSFER | `CRL_A` | Criminal Appeal |
| `X-OBJ` | Cross Objection | `XOBJ, CO` | Cross Objection | Cross Objection |
| `EDC` | ESTATE DUTY CASE | `EDA` | Estate Duty Appeal |
| `EXEP` | EXECUTION PETITION | `EA` | Execution Application (Civil) |
| `AS` | FIRST APPEAL | `FA, AS` | First Appeal | Appeal from Subordinate Court |
| `GTC` | GIFT TAX CASE | `GTA` | Gift Tax Appeal |
| `ITC` | INCOME TAX CASE | `ITA, Tax_Ref` | Income Tax Appeal | Tax Reference Case |
| `ITTA` | INCOME TAX TRIBUNAL APPEAL | `ITA` | Income Tax Appeal |
| `MACMA` | MOTOR ACCIDENT CIVIL MISCELLANEOUS APPEAL | `MACA` | Motor Accident Claims Appeal |
| `OP` | ORIGINAL PETITION | `OMP` | Original Miscellaneous Petition |
| `WP(PIL)` | PUBLIC INTEREST LITIGATION | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `REFCRLA` | REFERRED CRLA | `CRL_A` | Criminal Appeal |
| … | 11 more | | |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CMA` | CIVIL MISCELLANEOUS APPEAL | `CMA` | Civil Miscellaneous Appeal |
| `CRP` | CIVIL REVISION PETITION | `CRP` | Civil Revision Petition |
| `CS` | CIVIL SUIT | `CS` | Civil Suit |
| `CRLP` | CRIMINAL PETITION | `CRLP` | Criminal Leave Petition |
| `CRLRC` | CRIMINAL REVISION CASE | `CRLRC, CR_REV` | Criminal Revision Case | Criminal Revision |
| `EP` | ELECTION PETITION | `EP` | Election Petition |
| `LPA` | LETTER PATENT APPEAL | `LPA` | Letters Patent Appeal |
| `PIL` | PUBLIC INTEREST LITIGATION (OLD) | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `SA` | SECOND APPEAL | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL | `WTA` | Wealth Tax Appeal |
| `WA` | WRIT APPEAL | `WA` | Writ Appeal |
### Tripura High Court — Agartala

- **benchId:** `40` · **local types:** 94
- **Exact:** 11 · **Suggested:** 12 · **Review:** 11 · **Conflict:** 5 · **No eCourts type:** 55
- **Writ-related maps:** `WA` → `WA`, `W.P.(Crl.)` → `WP_CRL`, `WP(C)(PIL)` → `WP_C_PIL`, `PIL` → `PIL, WP_PIL, WP_C_PIL`, `WP(C)(HC)` → `HCP, WP_C`, `WP(C)` → `WP_C`
- **Code conflicts (do not send local code as eCourts facet):** `CA` (CA), `MFA` (First Appeal against judgments in Special jurisdiction cases.), `RA` (Review Application), `SCA` (SUPREME COURT APPEAL), `TS` (Testamentory Suit)

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Crl.A.` | Appeal Against Judgment Or Sentence. | `CRL_A` | Criminal Appeal |
| `WA` | Appeal before Division Bench against judgment or order of Single Judge in a Writ Petition. | `WA` | Writ Appeal |
| `ITA` | Application under Section 256(2) | `ITA` | Income Tax Appeal |
| `CAVT` | Caveat | `CAV` | Caveat |
| `RCFA` | First Appeal | `FA` | First Appeal |
| `RFA` | First Appeal from Judgment and Decree in Suit | `RFA, FA` | Regular First Appeal | First Appeal |
| `MAF` | Miscellaneous Appeal(first) | `MFA` | Miscellaneous First Appeal |
| `MAC App.` | Motor Accident Claims Appeal | `MACA` | Motor Accident Claims Appeal |
| `SCLP` | Petition for Leave to Appeal to Supreme Court | `SLP_C, SLP_CRL` | Special Leave Petition (Civil) | Special Leave Petition (Criminal) |
| `RCSA` | Second Appeal | `SA, RCS_A` | Second Appeal | Regular Civil Suit - Class A |
| `RSA` | Second Appeal from Judgment and Decree | `RSA, SA` | Regular Second Appeal | Second Appeal |
| `WP(C)` | Writ Petition under Article 226 and 227 of the Constitution | `WP_C` | Writ Petition (Civil) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `Arb.A.` | Appeals under Indian Arbitration Act. | `ARB_A` | Arbitration Appeal |
| `BA` | Bail Application | `BA` | Bail Application |
| `CRP` | Civil Revision Petition | `CRP` | Civil Revision Petition |
| `CS` | Civil Suit | `CS` | Civil Suit |
| `FA` | First Appeal | `FA` | First Appeal |
| `LPA` | Latters Patent Appeal | `LPA` | Letters Patent Appeal |
| `CMAppl.` | Miscellaneous Applications | `CMAppl` | Civil Miscellaneous Application |
| `W.P.(Crl.)` | Petition U/A 226 For Writ And Habeas Corpus And Other Relief In Relation To A Criminal Pro | `WP_CRL` | Writ Petition (Criminal) |
| `WP(C)(PIL)` | Public Interest Letigation | `WP_C_PIL` | Writ Petition (Public Interest Litigation) |
| `PIL` | Public Interest Litigation | `PIL, WP_PIL, WP_C_PIL` | Public Interest Litigation | Writ Petition (Public Interest Litigation) | Writ Petition (Public Interest Litigation) |
| `SA` | Second Appeal | `SA, RSA` | Second Appeal | Regular Second Appeal |
### Uttarakhand High Court — Nainital

- **benchId:** `41` · **local types:** 198
- **Exact:** 9 · **Suggested:** 2 · **Review:** 13 · **Conflict:** 3 · **No eCourts type:** 171
- **Writ-related maps:** `WPCRL` → `WP_CRL`, `WPCRLS` → `WP_CRL`, `WPPIL` → `WP_PIL`
- **Code conflicts (do not send local code as eCourts facet):** `DREF` (DEFECTIVE REFERENCE(118)), `IA` (INTERLOCUTARY APPLICATION(3)), `REF` (REFERENCE(57))

#### Suggested maps (seed these)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `CRLA` | CRIMINAL APPEAL(14) | `CRL_A` | Criminal Appeal |
| `WPCRL` | WRIT PETITION CRIMINAL(168) | `WP_CRL` | Writ Petition (Criminal) |

#### Exact matches (search as-is)

| Local code | Local name | eCourts codes | eCourts name |
|---|---|---|---|
| `ABA` | ANTICIPATORY BAIL APPLICATION(183) | `ABA` | Anticipatory Bail Application |
| `CAV` | CAVEAT(49) | `CAV` | Caveat |
| `FA` | FIRST APPEAL(17) | `FA` | First Appeal |
| `GTA` | GIFT TAX APPEAL(173) | `GTA` | Gift Tax Appeal |
| `ITA` | INCOME TAX APPEAL(41) | `ITA` | Income Tax Appeal |
| `OS` | ORIGINAL SUIT (CIVIL SUIT)(175) | `OS` | Original Suit |
| `SA` | SECOND APPEAL(25) | `SA, RSA` | Second Appeal | Regular Second Appeal |
| `WTA` | WEALTH TAX APPEAL(172) | `WTA` | Wealth Tax Appeal |
| `WPPIL` | WRIT PETITION PUBLIC INTEREST LITIGATION(167) | `WP_PIL` | Writ Petition (Public Interest Litigation) |


## Frontend contract (do not break)

Court Daily Business `searchByCaseNumber` will keep sending:

- `courtCode` — eCourts partner court code (e.g. `HBHC01`)
- `courtLevel` — `HC` or `SC`
- `caseTypeCode` — **our** `/api/casetypes` code (e.g. `WP`)
- `caseNumber` — digits as typed (`1290`)
- `year` — `2019`

The backend must expand `caseTypeCode` using `case_type_ecourts_map` for that bench. The UI will not send `WP_C`.
