import { formatCaseNumberWithType } from '../api/ecourts';
import type { CaseDetail, CourtLevel, SearchModeId } from '../types/ecourts';

export type PdfReportKind = 'casehistory' | 'dailybusiness' | 'orders';

export type PdfFileNameContext = {
  searchMode: SearchModeId;
  courtLevel?: CourtLevel;
  /** Bench selected in Case Status search (HC/SC). */
  benchName?: string;
  /** Court selected in Case Status search, used when no bench is selected. */
  courtName?: string;
};

function firstNonEmpty(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = (value || '').trim();
    if (trimmed && trimmed !== '—') return trimmed;
  }
  return '';
}

function courtOfFromDetails(caseData: CaseDetail): string {
  return firstNonEmpty(...(caseData.businessOnDateEntries ?? []).map((entry) => entry.courtOf));
}

function sanitizeFilePart(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/[.,]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return cleaned || 'NA';
}

function formatDownloadDate(date = new Date()): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  return `${day}-${month}-${year}`;
}

export function inferCourtLevel(caseData: CaseDetail): CourtLevel {
  const haystack =
    `${caseData.courtName || ''} ${caseData.courtCode || ''} ${caseData.benchName || ''} ${courtOfFromDetails(caseData)}`.toLowerCase();

  if (/\bsupreme\b/.test(haystack)) return 'SC';
  if (
    /\btribunal\b|\bnclt\b|\bnclat\b|\bitat\b|\bdrt\b|\bcestat\b|\baptel\b|\bncdrc\b/.test(
      haystack,
    )
  ) {
    return 'TRIBUNAL';
  }
  if (/\bhigh\s*court\b|\bhighcourt\b/.test(haystack)) return 'HC';
  if (
    /\bdistrict\b|\bsession\b|\bcivil (judge|court)\b|\bmagistrate\b|\bjunior civil\b|\baddl\b/.test(
      haystack,
    )
  ) {
    return 'DC';
  }

  const cnr = (caseData.cnr || '').toUpperCase();
  if (cnr.startsWith('SC')) return 'SC';
  if (cnr.length >= 4 && cnr.slice(2, 4) === 'HC') return 'HC';
  if (cnr.length === 16) return 'DC';
  return 'HC';
}

function resolveBenchOrCourtName(caseData: CaseDetail, context: PdfFileNameContext): string {
  if (context.searchMode === 'case-status') {
    const selected = firstNonEmpty(context.benchName, context.courtName);
    if (selected) return selected;
  }

  return (
    firstNonEmpty(
      caseData.benchName,
      caseData.courtName,
      courtOfFromDetails(caseData),
      caseData.courtCode,
    ) || 'Court'
  );
}

function courtLevelTag(level: CourtLevel): string {
  if (level === 'TRIBUNAL') return 'TRIBUNAL';
  return level;
}

export function buildPdfFileName(
  kind: PdfReportKind,
  caseData: CaseDetail,
  context: PdfFileNameContext,
): string {
  const level = context.courtLevel ?? inferCourtLevel(caseData);
  const bench = sanitizeFilePart(resolveBenchOrCourtName(caseData, context));
  const downloadedOn = formatDownloadDate();

  const formattedCaseNumber = formatCaseNumberWithType(caseData);
  const identity =
    context.searchMode === 'cnr'
      ? sanitizeFilePart(caseData.cnr || 'CNR')
      : sanitizeFilePart(
          formattedCaseNumber && formattedCaseNumber !== '—'
            ? formattedCaseNumber
            : caseData.cnr || 'case',
        );

  return `${kind}_${identity}_${courtLevelTag(level)}_${bench}_${downloadedOn}`;
}
