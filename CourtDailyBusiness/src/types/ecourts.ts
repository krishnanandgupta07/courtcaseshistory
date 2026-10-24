export type CourtLevel = 'SC' | 'HC' | 'DC' | 'TRIBUNAL';

export type CourtTypeId = 'supreme' | 'high' | 'district' | 'tribunal';

export type SearchModeId = 'case-status' | 'cnr';

export type SelectOption = {
  code: string;
  name: string;
};

export type CaseHearing = {
  causeListType?: string;
  judge?: string;
  hearingDate?: string;
  businessOnDate?: string;
  purposeOfListing?: string;
};

export type BusinessOnDateEntry = {
  date?: string;
  courtOf?: string;
  petitioner?: string;
  respondent?: string;
  business?: string;
  nextPurpose?: string;
  nextHearingDate?: string;
};

export type CaseOrder = {
  orderDate?: string;
  orderType?: string;
  orderUrl?: string;
};

export type InterlocutoryApplication = {
  regNo?: string;
  particular?: string;
  remark?: string;
  filedBy?: string;
  filingDate?: string;
  status?: string;
};

export type CaseFile = {
  pdfFile?: string;
  pdfUrl?: string;
  markdownFile?: string;
  markdownContent?: string;
};

export type CaseSearchResult = {
  cnr?: string;
  caseStatus?: string;
  filingDate?: string | null;
  nextHearingDate?: string | null;
  courtCode?: string;
  petitioners?: string[];
  respondents?: string[];
  [key: string]: unknown;
};

export type CaseDetail = CaseSearchResult & {
  caseNumber?: string;
  caseType?: string;
  caseTypeRaw?: string;
  caseTypeSub?: string;
  filingNumber?: string;
  registrationNumber?: string;
  registrationDate?: string | null;
  decisionDate?: string | null;
  disposalType?: string;
  district?: string;
  state?: string;
  courtName?: string;
  benchName?: string;
  purpose?: string;
  lastHearingDate?: string | null;
  contestedStatus?: string;
  judicialSection?: string;
  caseCategoryFacetPath?: string;
  petitionerAdvocates?: string[];
  respondentAdvocates?: string[];
  judges?: string[];
  historyOfCaseHearings?: CaseHearing[];
  businessOnDateEntries?: BusinessOnDateEntry[];
  judgmentOrders?: CaseOrder[];
  interimOrders?: CaseOrder[];
  interlocutoryApplications?: InterlocutoryApplication[];
  linkCases?: unknown[];
  earlierCourtDetails?: unknown[];
  notices?: unknown[];
  listingDates?: unknown[];
  subordinateCourt?: Record<string, unknown> | null;
  firDetails?: Record<string, unknown> | null;
  files?: CaseFile[];
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
