import {
  ApiError,
  type BusinessOnDateEntry,
  type CaseDetail,
  type CaseFile,
  type CaseHearing,
  type CaseOrder,
  type CaseSearchResult,
  type CourtLevel,
  type InterlocutoryApplication,
  type SelectOption,
} from '../types/ecourts';


const DEFAULT_API_BASE = 'https://api.courtlivestream.com';

function getApiBaseUrl(): string {
  const base = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE;
  return base.replace(/\/$/, '');
}

function getAdminToken(): string {
  return (import.meta.env.VITE_ADMIN_API_TOKEN || '').trim();
}

function unwrapData(payload: unknown): unknown {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: unknown }).data;
  }
  return payload;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
    if (typeof value === 'number') return String(value);
  }
  return undefined;
}

function normalizeOption(item: unknown): SelectOption | null {
  if (typeof item === 'string' && item.trim()) {
    return { code: item.trim(), name: item.trim() };
  }

  const record = asRecord(item);
  if (!record) return null;

  const code = pickString(record, [
    'code',
    'courtCode',
    'caseTypeCode',
    'value',
    'id',
    'key',
  ]);
  const name =
    pickString(record, [
      'name',
      'description',
      'stateName',
      'districtName',
      'courtComplexName',
      'courtName',
      'tribunalName',
      'label',
      'caseTypeName',
      'title',
      'displayName',
    ]) ?? code;
  if (!code || !name) return null;
  return { code, name };
}

function collectOptionCandidates(value: unknown, depth = 0): unknown[] {
  if (depth > 4 || value == null) return [];
  if (Array.isArray(value)) return value;

  const record = asRecord(value);
  if (!record) return [];

  const preferredKeys = [
    'caseType',
    'caseTypes',
    'courts',
    'items',
    'results',
    'enums',
    'values',
    'options',
  ];

  for (const key of preferredKeys) {
    if (!(key in record)) continue;
    const found = collectOptionCandidates(record[key], depth + 1);
    if (found.length > 0) return found;
  }

  for (const nested of Object.values(record)) {
    const found = collectOptionCandidates(nested, depth + 1);
    if (found.length > 0) return found;
  }

  return [];
}

function normalizeOptions(payload: unknown): SelectOption[] {
  const data = unwrapData(payload);
  const candidates = collectOptionCandidates(data);

  const seen = new Set<string>();
  const options: SelectOption[] = [];
  for (const candidate of candidates) {
    const option = normalizeOption(candidate);
    if (!option || seen.has(option.code)) continue;
    seen.add(option.code);
    options.push(option);
  }
  return options;
}

/** Sort dropdown options A→Z by display name (then code). */
function sortSelectOptions(options: SelectOption[]): SelectOption[] {
  return [...options].sort((a, b) => {
    const byName = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    if (byName !== 0) return byName;
    return a.code.localeCompare(b.code, undefined, { sensitivity: 'base', numeric: true });
  });
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value
    .map((entry) => {
      if (typeof entry === 'string') return entry;
      const record = asRecord(entry);
      if (!record) return undefined;
      return pickString(record, ['name', 'partyName', 'party_name', 'lname', 'title', 'judge']);
    })
    .filter((name): name is string => Boolean(name));
  return items.length > 0 ? items : undefined;
}

function normalizeHearings(value: unknown): CaseHearing[] {
  if (!Array.isArray(value)) return [];
  const hearings: CaseHearing[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    hearings.push({
      causeListType: pickString(record, ['causeListType', 'causelistType']),
      judge: pickString(record, ['judge', 'judges', 'coram']),
      hearingDate: pickString(record, ['hearingDate', 'date', 'listingDate']),
      businessOnDate: pickString(record, ['businessOnDate']),
      purposeOfListing: pickString(record, ['purposeOfListing', 'purpose', 'stage']),
    });
  }
  return hearings;
}

function normalizeBusinessOnDateEntries(value: unknown): BusinessOnDateEntry[] {
  if (!Array.isArray(value)) return [];
  const entries: BusinessOnDateEntry[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    entries.push({
      date: pickString(record, ['date', 'businessDate', 'businessOnDate', 'hearingDate']),
      courtOf: pickString(record, ['courtOf', 'court', 'courtName']),
      petitioner: pickString(record, ['petitioner', 'petitioners']),
      respondent: pickString(record, ['respondent', 'respondents']),
      business: pickString(record, ['business', 'businessOnDate', 'remarks', 'remark']),
      nextPurpose: pickString(record, ['nextPurpose', 'purpose', 'purposeOfListing']),
      nextHearingDate: pickString(record, ['nextHearingDate', 'nextDate']),
    });
  }
  return entries;
}

function normalizeOrders(value: unknown): CaseOrder[] {
  if (!Array.isArray(value)) return [];
  const orders: CaseOrder[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    orders.push({
      orderDate: pickString(record, ['orderDate', 'date']),
      orderType: pickString(record, ['orderType', 'type']),
      orderUrl: pickString(record, ['orderUrl', 'url', 'pdfUrl', 'fileName']),
    });
  }
  return orders;
}

function normalizeIAs(value: unknown): InterlocutoryApplication[] {
  if (!Array.isArray(value)) return [];
  const applications: InterlocutoryApplication[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    applications.push({
      regNo: pickString(record, ['regNo', 'registrationNumber', 'iaNumber']),
      particular: pickString(record, ['particular', 'particulars', 'purpose']),
      remark: pickString(record, ['remark', 'remarks']),
      filedBy: pickString(record, ['filedBy', 'filed_by']),
      filingDate: pickString(record, ['filingDate', 'date']),
      status: pickString(record, ['status']),
    });
  }
  return applications;
}

function normalizeFiles(value: unknown): CaseFile[] {
  if (!Array.isArray(value)) return [];
  const files: CaseFile[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    files.push({
      pdfFile: pickString(record, ['pdfFile', 'pdf', 'fileName']),
      markdownFile: pickString(record, ['markdownFile', 'mdFile']),
      markdownContent: pickString(record, ['markdownContent', 'content']),
    });
  }
  return files;
}

function normalizeCaseResult(item: unknown): CaseDetail {
  const record = asRecord(item) ?? {};
  const petitioners =
    extractPartyNames(record.petitioners) ??
    extractPartyNames(record.petitioner) ??
    extractPartyNames(record.petitionerNames);
  const respondents =
    extractPartyNames(record.respondents) ??
    extractPartyNames(record.respondent) ??
    extractPartyNames(record.respondentNames);

  return {
    ...record,
    cnr: pickString(record, ['cnr', 'CNR', 'cnrNumber']),
    caseStatus: pickString(record, ['caseStatus', 'status', 'case_status']),
    filingDate: pickString(record, ['filingDate', 'filing_date', 'dateOfFiling']) ?? null,
    nextHearingDate: pickString(record, ['nextHearingDate', 'next_hearing_date', 'nextHearing']) ?? null,
    courtCode: pickString(record, ['courtCode', 'court_code', 'cnrCourtCode', 'courtName', 'code']),
    petitioners,
    respondents,
    benchName: pickString(record, ['benchName', 'benchType']),
    purpose: pickString(record, ['purpose']),
    lastHearingDate: pickString(record, ['lastHearingDate']) ?? null,
    contestedStatus: pickString(record, ['contestedStatus']),
    judicialSection: pickString(record, ['judicialSection', 'judicialSectionRaw']),
    caseCategoryFacetPath: pickString(record, ['caseCategoryFacetPath', 'caseCategory']),
    courtName: pickString(record, ['courtName']),
    caseType: pickString(record, ['caseType']),
    caseTypeRaw: pickString(record, ['caseTypeRaw']),
    caseTypeSub: pickString(record, ['caseTypeSub']),
    filingNumber: pickString(record, ['filingNumber', 'stampNumber']),
    registrationNumber: pickString(record, ['registrationNumber']),
    registrationDate: pickString(record, ['registrationDate']) ?? null,
    decisionDate: pickString(record, ['decisionDate', 'disposalDate']) ?? null,
    disposalType: pickString(record, ['disposalType', 'disposalTypeRaw']),
    district: pickString(record, ['district']),
    state: pickString(record, ['state']),
    caseNumber: pickString(record, ['caseNumber', 'registrationNumber']),
    petitionerAdvocates: asStringArray(record.petitionerAdvocates),
    respondentAdvocates: asStringArray(record.respondentAdvocates),
    judges: asStringArray(record.judges),
    historyOfCaseHearings: normalizeHearings(record.historyOfCaseHearings),
    businessOnDateEntries: normalizeBusinessOnDateEntries(record.businessOnDateEntries),
    judgmentOrders: normalizeOrders(record.judgmentOrders),
    interimOrders: normalizeOrders(record.interimOrders),
    interlocutoryApplications: normalizeIAs(record.interlocutoryApplications),
    linkCases: Array.isArray(record.linkCases) ? record.linkCases : [],
    earlierCourtDetails: Array.isArray(record.earlierCourtDetails) ? record.earlierCourtDetails : [],
    notices: Array.isArray(record.notices) ? record.notices : [],
    listingDates: Array.isArray(record.listingDates) ? record.listingDates : [],
    subordinateCourt: asRecord(record.subordinateCourt),
    firDetails: asRecord(record.firDetails),
  };
}

function extractPartyNames(value: unknown): string[] | undefined {
  return asStringArray(value);
}

function extractResults(payload: unknown): CaseDetail[] {
  const data = unwrapData(payload);
  if (Array.isArray(data)) return data.map(normalizeCaseResult);

  const record = asRecord(data);
  if (!record) return [];

  for (const key of [
    'courtCaseData',
    'results',
    'cases',
    'items',
    'case',
    'caseDetails',
    'case_detail',
  ]) {
    const value = record[key];
    if (Array.isArray(value)) return value.map(normalizeCaseResult);
    if (asRecord(value)) return [normalizeCaseResult(value)];
  }

  const petitioners = record.petitioners ?? record.petitioner ?? record.petitionerNames;
  const respondents = record.respondents ?? record.respondent ?? record.respondentNames;
  if (
    pickString(record, ['cnr', 'CNR', 'cnrNumber']) ||
    petitioners ||
    respondents ||
    pickString(record, ['caseStatus', 'status'])
  ) {
    return [
      normalizeCaseResult({
        ...record,
        petitioners: extractPartyNames(petitioners) ?? record.petitioners,
        respondents: extractPartyNames(respondents) ?? record.respondents,
      }),
    ];
  }

  return [];
}

function extractCaseDetail(payload: unknown): CaseDetail | null {
  const data = unwrapData(payload);
  const record = asRecord(data);
  if (!record) {
    const results = extractResults(payload);
    return results[0] ?? null;
  }

  const caseNode = asRecord(record.courtCaseData) ?? record;
  const detail = normalizeCaseResult(caseNode);
  const filesWrapper = asRecord(record.files);
  const files = normalizeFiles(filesWrapper?.files ?? record.files);
  if (files.length > 0) {
    detail.files = files;
  }

  if (!detail.cnr && !detail.petitioners?.length && !detail.respondents?.length) {
    return null;
  }

  return detail;
}

function extractServerMessage(body: unknown): string | undefined {
  const record = asRecord(body);
  if (!record) return undefined;

  const data = asRecord(record.data);
  const nestedError = data ? asRecord(data.error) : null;
  const fromNested = nestedError
    ? pickString(nestedError, ['message', 'detail', 'error'])
    : undefined;
  if (fromNested) return fromNested;

  const errorField = record.error;
  if (typeof errorField === 'string' && errorField.trim()) return errorField;
  const errorObj = asRecord(errorField);
  if (errorObj) {
    const fromError = pickString(errorObj, ['message', 'detail']);
    if (fromError) return fromError;
  }

  return pickString(record, ['message', 'detail']);
}

function messageForStatus(status: number, fallback: string): string {
  if (status === 401) return 'Authentication failed. Check the admin API token.';
  if (status === 403) return 'Access denied. Your account does not have permission for this request.';
  if (status === 504 || status === 502) {
    return fallback || 'The CourtLiveStream API timed out. Please retry in a moment.';
  }
  if (status === 503) return 'Service temporarily unavailable. Please try again shortly.';
  if (status === 404) return fallback || 'No case found for the given details.';
  return fallback || `Request failed (${status}).`;
}

function assertApiSuccess(body: unknown, status = 200): void {
  const record = asRecord(body);
  if (!record) return;
  if (record.success === false) {
    const serverMessage = extractServerMessage(body) || 'Request failed.';
    throw new ApiError(status, messageForStatus(status, serverMessage));
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  let body: unknown = null;
  const text = await response.text();
  if (text) {
    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
      body = {
        message:
          response.status === 504 || response.status === 502
            ? 'The CourtLiveStream API timed out while loading this data.'
            : `Upstream returned an HTML error page (${response.status}).`,
      };
    } else {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { message: text.slice(0, 300) };
      }
    }
  }
  return body;
}

async function apiRequest(
  method: 'GET' | 'POST',
  path: string,
  query?: Record<string, string>,
  options?: { requireAuth?: boolean },
): Promise<unknown> {
  const requireAuth = options?.requireAuth !== false;
  const token = getAdminToken();
  if (requireAuth && !token) {
    throw new ApiError(503, 'Admin API token is not configured. Set VITE_ADMIN_API_TOKEN in your .env file.');
  }

  const url = new URL(`${getApiBaseUrl()}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== '') url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const maxAttempts = method === 'GET' ? 3 : 2;
  let response: Response | null = null;
  let lastNetworkError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      response = await fetch(url.toString(), {
        method,
        headers,
      });
      lastNetworkError = null;
      break;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt));
        continue;
      }
    }
  }

  if (!response) {
    const detail =
      lastNetworkError instanceof Error && lastNetworkError.message
        ? ` (${lastNetworkError.message})`
        : '';
    throw new ApiError(
      503,
      `Could not reach the API${detail}. This is usually a temporary network, timeout, or CORS preflight failure — not always a CORS config bug. Retry in a moment.`,
    );
  }

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const serverMessage =
      extractServerMessage(body) || `Request failed (${response.status}).`;
    throw new ApiError(response.status, messageForStatus(response.status, serverMessage));
  }

  assertApiSuccess(body, response.status);
  return body;
}

async function apiGet(
  path: string,
  query?: Record<string, string>,
  options?: { requireAuth?: boolean },
): Promise<unknown> {
  return apiRequest('GET', path, query, options);
}

async function apiPost(
  path: string,
  query?: Record<string, string>,
  options?: { requireAuth?: boolean },
): Promise<unknown> {
  return apiRequest('POST', path, query, options);
}

async function apiGetPublic(path: string, query?: Record<string, string>): Promise<unknown> {
  return apiGet(path, query, { requireAuth: false });
}

export type AppCourtGroup = {
  courtName: string;
  benches: SelectOption[];
};

const appCourtsCache: Partial<Record<'SC' | 'HC', AppCourtGroup[]>> = {};

function groupCourtsByName(
  items: unknown[],
  courtLevel: CourtLevel,
): AppCourtGroup[] {
  const byCourt = new Map<string, SelectOption[]>();

  for (const item of items) {
    const record = asRecord(item);
    if (!record) continue;
    const courtName = pickString(record, ['courtName', 'name']);
    if (!courtName) continue;

    const isSupreme = /supreme/i.test(courtName);
    if (courtLevel === 'SC' && !isSupreme) continue;
    if (courtLevel === 'HC' && isSupreme) continue;

    const id = pickString(record, ['id', 'benchId']);
    const name =
      pickString(record, ['benchName', 'name', 'benchType']) ?? id;
    if (!id || !name) continue;

    const benches = byCourt.get(courtName) ?? [];
    if (!benches.some((bench) => bench.code === id)) {
      benches.push({ code: id, name });
    }
    byCourt.set(courtName, benches);
  }

  return Array.from(byCourt.entries()).map(([courtName, benches]) => ({
    courtName,
    benches,
  }));
}

function groupAppCourtsListPayload(data: unknown[], courtLevel: CourtLevel): AppCourtGroup[] {
  const groups: AppCourtGroup[] = [];
  for (const item of data) {
    const record = asRecord(item);
    if (!record) continue;
    const courtName = pickString(record, ['courtName', 'name']);
    if (!courtName) continue;

    const isSupreme = /supreme/i.test(courtName);
    if (courtLevel === 'SC' && !isSupreme) continue;
    if (courtLevel === 'HC' && isSupreme) continue;

    const benchesRaw = record.benches;
    const benches: SelectOption[] = [];
    if (Array.isArray(benchesRaw)) {
      for (const bench of benchesRaw) {
        const benchRecord = asRecord(bench);
        if (!benchRecord) continue;
        const id = pickString(benchRecord, ['id', 'benchId']);
        const name =
          pickString(benchRecord, ['benchName', 'name', 'benchType']) ?? id;
        if (!id || !name) continue;
        benches.push({ code: id, name });
      }
    }

    if (benches.length === 0) continue;
    groups.push({ courtName, benches });
  }
  return groups;
}

/**
 * Local benches for SC/HC.
 * Prefers lightweight admin dropdown (no court halls). Falls back to /api/app/courts/list.
 * Results are cached in-memory per court level.
 */
export async function fetchAppCourtsList(courtLevel: CourtLevel): Promise<AppCourtGroup[]> {
  if (courtLevel !== 'SC' && courtLevel !== 'HC') {
    throw new ApiError(400, 'App courts list is only available for Supreme Court and High Court.');
  }

  const cached = appCourtsCache[courtLevel];
  if (cached && cached.length > 0) return cached;

  let groups: AppCourtGroup[] = [];

  // Fast path: only id + courtName + benchName (no halls payload).
  if (getAdminToken()) {
    try {
      const dropdownBody = await apiGet('/api/courts', { dropdown: 'true' });
      const dropdownData = unwrapData(dropdownBody);
      if (Array.isArray(dropdownData) && dropdownData.length > 0) {
        groups = groupCourtsByName(dropdownData, courtLevel);
      }
    } catch {
      // Fall through to public app list.
    }
  }

  if (groups.length === 0) {
    const body = await apiGetPublic('/api/app/courts/list');
    const data = unwrapData(body);
    if (!Array.isArray(data) || data.length === 0) {
      throw new ApiError(503, 'No courts returned by the app courts API.');
    }
    groups = groupAppCourtsListPayload(data, courtLevel);
  }

  if (groups.length === 0) {
    throw new ApiError(
      503,
      courtLevel === 'SC'
        ? 'No Supreme Court benches were returned.'
        : 'No High Court benches were returned.',
    );
  }

  appCourtsCache[courtLevel] = groups;
  return groups;
}

/** Case types for a local bench (`case_types` table). Public `benchId` query. */
export async function fetchCaseTypesByBench(benchId: string): Promise<SelectOption[]> {
  const body = await apiGetPublic('/api/web/casetypes', { benchId });
  const options = sortSelectOptions(
    normalizeOptions(body).filter((option) => option.code !== 'UNKNOWN'),
  );
  return requireOptions(options, 'No case types returned for the selected bench.');
}

const COURT_MATCH_STOPWORDS = new Set([
  'high',
  'court',
  'of',
  'the',
  'and',
  'at',
  'bench',
  'seat',
  'principal',
  'india',
  'state',
  'for',
  'judicature',
  'new',
  'delhi',
]);

function tokenizeForCourtMatch(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !COURT_MATCH_STOPWORDS.has(token));
}

/** Map local court/bench names to eCourts Partner courtCode for by-case-number search. */
export function resolveEcourtsCourtCode(
  ecourtsCourts: SelectOption[],
  courtName: string,
  benchName: string,
): string | null {
  if (ecourtsCourts.length === 0) return null;
  if (ecourtsCourts.length === 1) return ecourtsCourts[0].code;

  const courtTokens = tokenizeForCourtMatch(courtName);
  const benchTokens = tokenizeForCourtMatch(benchName);
  let bestCode: string | null = null;
  let bestScore = -1;

  for (const court of ecourtsCourts) {
    const name = court.name.toLowerCase();
    let score = 0;
    for (const token of courtTokens) {
      if (name.includes(token)) score += 2;
    }
    for (const token of benchTokens) {
      if (name.includes(token)) score += 4;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCode = court.code;
    }
  }

  return bestScore > 0 ? bestCode : null;
}

export async function fetchCourts(courtLevel: CourtLevel): Promise<SelectOption[]> {
  const body = await apiGet('/api/admin/ecourts/courts', { courtLevel });
  const options = normalizeOptions(body);
  if (options.length === 0) {
    throw new ApiError(503, `No courts returned for court level ${courtLevel}.`);
  }
  return options;
}

const REFERENCE_BASE = '/api/admin/ecourts/reference';

function requireOptions(options: SelectOption[], emptyMessage: string): SelectOption[] {
  if (options.length === 0) {
    throw new ApiError(503, emptyMessage);
  }
  return options;
}

/** Prefer courtCode over UUID id when both exist (for search by-case-number). */
function normalizeCourtCodeOptions(payload: unknown): SelectOption[] {
  const data = unwrapData(payload);
  const candidates = collectOptionCandidates(data);
  const seen = new Set<string>();
  const options: SelectOption[] = [];

  for (const candidate of candidates) {
    const record = asRecord(candidate);
    if (!record) {
      const option = normalizeOption(candidate);
      if (!option || seen.has(option.code)) continue;
      seen.add(option.code);
      options.push(option);
      continue;
    }

    const code = pickString(record, ['courtCode', 'code', 'value', 'id']);
    const name =
      pickString(record, [
        'courtName',
        'tribunalName',
        'name',
        'description',
        'label',
        'title',
        'displayName',
      ]) ?? code;
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    options.push({ code, name });
  }

  return options;
}

export async function fetchReferenceStates(): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/states`);
  return requireOptions(normalizeOptions(body), 'No states returned by the API.');
}

export async function fetchReferenceDistricts(stateId: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/districts`, { stateId });
  return requireOptions(normalizeOptions(body), 'No districts returned for the selected state.');
}

export async function fetchReferenceCourtComplexes(districtId: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/court-complexes`, { districtId });
  return requireOptions(
    normalizeOptions(body),
    'No court complexes returned for the selected district.',
  );
}

export async function fetchReferenceCourts(courtComplexId: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/courts`, { courtComplexId });
  return requireOptions(
    normalizeCourtCodeOptions(body),
    'No courts returned for the selected court complex.',
  );
}

export async function fetchReferenceTribunals(): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/tribunals`);
  return requireOptions(normalizeOptions(body), 'No tribunals returned by the API.');
}

export async function fetchReferenceTribunalCourts(tribunalCode: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/tribunal-courts`, { tribunalCode });
  return requireOptions(
    normalizeCourtCodeOptions(body),
    'No tribunal courts returned for the selected tribunal.',
  );
}

/** District Court case types from local DB, scoped by district → state.
 * Falls back to global enums when the district DB has no seeded types. */
export async function fetchReferenceCaseTypes(districtId: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/case-types`, { districtId });
  const options = sortSelectOptions(
    normalizeOptions(body).filter((option) => option.code !== 'UNKNOWN'),
  );
  if (options.length > 0) return options;
  return fetchCaseTypes();
}

/** Tribunal case types from live eCourts enums, filtered by tribunal court family.
 * Falls back to global enums when the filtered list is empty. */
export async function fetchReferenceTribunalCaseTypes(courtCode: string): Promise<SelectOption[]> {
  const body = await apiGet(`${REFERENCE_BASE}/tribunal-case-types`, { courtCode });
  const options = sortSelectOptions(
    normalizeOptions(body).filter((option) => option.code !== 'UNKNOWN'),
  );
  if (options.length > 0) return options;
  return fetchCaseTypes();
}

let caseTypesCache: SelectOption[] | null = null;
let caseTypesPromise: Promise<SelectOption[]> | null = null;

export async function fetchCaseTypes(): Promise<SelectOption[]> {
  if (caseTypesCache) return caseTypesCache;
  if (caseTypesPromise) return caseTypesPromise;

  caseTypesPromise = (async () => {
    // Prefer full enums payload. `?types=caseType` often times out (504) on the API.
    const body = await apiGet('/api/admin/ecourts/enums');
    const options = sortSelectOptions(
      normalizeOptions(body).filter((option) => option.code !== 'UNKNOWN'),
    );
    if (options.length === 0) {
      throw new ApiError(503, 'No case types were returned by the API.');
    }
    caseTypesCache = options;
    return options;
  })();

  try {
    return await caseTypesPromise;
  } catch (error) {
    caseTypesPromise = null;
    throw error;
  }
}

export type CaseRefreshStatus = {
  cnr: string;
  success: boolean;
  message?: string;
};

export type CaseNumberSearchResponse = {
  results: CaseDetail[];
  refresh: CaseRefreshStatus[];
};

function extractRefreshMeta(payload: unknown): CaseRefreshStatus[] {
  const record = asRecord(payload);
  const meta = asRecord(record?.meta);
  const refresh = meta?.refresh;
  if (!Array.isArray(refresh)) return [];

  const items: CaseRefreshStatus[] = [];
  for (const entry of refresh) {
    const row = asRecord(entry);
    if (!row) continue;
    const cnr = pickString(row, ['cnr', 'CNR', 'cnrNumber'])?.trim().toUpperCase();
    if (!cnr) continue;
    items.push({
      cnr,
      success: row.success !== false,
      message: pickString(row, ['message', 'error', 'errorMessage']),
    });
  }
  return items;
}

export async function searchByCaseNumber(params: {
  courtCode: string;
  courtLevel: CourtLevel;
  caseTypeCode: string;
  caseNumber: string;
  year: string;
}): Promise<CaseNumberSearchResponse> {
  const body = await apiGet('/api/admin/ecourts/search/by-case-number', {
    courtCode: params.courtCode,
    courtLevel: params.courtLevel,
    caseTypeCode: params.caseTypeCode,
    caseNumber: params.caseNumber,
    year: params.year,
  });
  return {
    results: extractResults(body),
    refresh: extractRefreshMeta(body),
  };
}

/** Load full CNR case payloads (orders, hearings, files) for search hits. */
export async function enrichSearchResultsWithCaseDetails(
  results: CaseDetail[],
): Promise<CaseDetail[]> {
  if (results.length === 0) return [];

  const enriched = await Promise.all(
    results.map(async (result) => {
      const cnr = result.cnr?.trim();
      if (!cnr) return result;
      try {
        return await fetchCaseByCnr(cnr);
      } catch {
        return result;
      }
    }),
  );

  return enriched;
}

export function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Wait for partner scrape, then re-fetch each CNR (keep prior detail on failure). */
export async function reloadCasesAfterRefresh(
  previous: CaseDetail[],
  delayMs = 8000,
): Promise<CaseDetail[]> {
  if (previous.length === 0) return [];
  await waitMs(delayMs);
  return enrichSearchResultsWithCaseDetails(previous);
}

/** CNRs that were not successfully queued for refresh by case-number search. */
export function cnrsNeedingExplicitRefresh(
  results: CaseDetail[],
  refresh: CaseRefreshStatus[],
): string[] {
  const byCnr = new Map(refresh.map((item) => [item.cnr.toUpperCase(), item]));
  const needed: string[] = [];
  for (const result of results) {
    const cnr = result.cnr?.trim().toUpperCase();
    if (!cnr) continue;
    const status = byCnr.get(cnr);
    if (!status || !status.success) needed.push(cnr);
  }
  return needed;
}

export async function refreshCaseByCnr(cnr: string): Promise<void> {
  const normalized = cnr.trim().toUpperCase();
  await apiPost(`/api/admin/ecourts/case/${encodeURIComponent(normalized)}/refresh`);
}

export async function fetchCaseByCnr(cnr: string): Promise<CaseDetail> {
  const normalized = cnr.trim().toUpperCase();
  const body = await apiGet(`/api/admin/ecourts/case/${encodeURIComponent(normalized)}`);
  const detail = extractCaseDetail(body);
  if (!detail) {
    throw new ApiError(404, `No case found for CNR '${normalized}'.`);
  }
  return detail;
}

export function formatCaseTitle(result: CaseSearchResult): string {
  const petitioners = (result.petitioners ?? []).filter(Boolean).join(', ');
  const respondents = (result.respondents ?? []).filter(Boolean).join(', ');
  if (petitioners && respondents) return `${petitioners} vs ${respondents}`;
  if (petitioners) return petitioners;
  if (respondents) return respondents;
  return result.cnr || 'Untitled case';
}

export function formatDisplayDate(value?: string | null): string {
  if (!value) return '—';
  const isoDay = value.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDay);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** Format as CaseType/Number/Year, e.g. WP/123/2026 or OS/278/2013. */
export function formatCaseNumberWithType(caseData: {
  caseType?: string;
  caseTypeRaw?: string;
  registrationNumber?: string;
  caseNumber?: string;
}): string {
  const typeLabel = (caseData.caseTypeRaw || caseData.caseType || '')
    .trim()
    .replace(/_.*$/, '')
    .toUpperCase();
  const registration = (caseData.registrationNumber || '').trim();

  if (registration && typeLabel) {
    const registrationUpper = registration.toUpperCase();
    if (
      registrationUpper.startsWith(`${typeLabel}/`) ||
      registrationUpper.startsWith(`${typeLabel} `)
    ) {
      return registration;
    }
    return `${typeLabel}/${registration}`;
  }

  if (registration) return registration;
  if (caseData.caseNumber?.trim()) return caseData.caseNumber.trim();
  return '—';
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}
