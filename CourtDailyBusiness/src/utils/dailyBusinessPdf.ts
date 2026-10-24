import { formatCaseNumberWithType, formatDisplayDate } from '../api/ecourts';
import type { BusinessOnDateEntry, CaseDetail } from '../types/ecourts';
import { printHtmlDocument, sortByDateValue } from './caseReportPdf';
import { pdfBrandStripCss, pdfBrandStripHtml } from './pdfBrandStrip';
import { buildPdfFileName, type PdfFileNameContext } from './pdfFileName';

export type DateSortOrder = 'asc' | 'desc';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function cell(value?: string | null): string {
  if (!value || !String(value).trim()) return '—';
  return escapeHtml(String(value));
}

export function getBusinessEventDate(entry: BusinessOnDateEntry): string | undefined {
  return entry.date;
}

export function sortBusinessEntries(
  entries: BusinessOnDateEntry[],
  order: DateSortOrder,
): BusinessOnDateEntry[] {
  return sortByDateValue(entries, getBusinessEventDate, order);
}

/** Show courtOf only when it changes from the previous row; otherwise blank. */
export function getCourtOfCellValue(
  entries: BusinessOnDateEntry[],
  index: number,
): string {
  const current = (entries[index]?.courtOf || '').trim();
  if (!current) return '';
  if (index === 0) return current;
  const previous = (entries[index - 1]?.courtOf || '').trim();
  if (previous.toLowerCase() === current.toLowerCase()) return '';
  return current;
}

function collectUniqueNames(...lists: Array<Array<string | undefined> | undefined>): string[] {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const list of lists) {
    for (const value of list ?? []) {
      const trimmed = (value || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      names.push(trimmed);
    }
  }

  return names;
}

export function getDailyBusinessHeader(caseData: CaseDetail, entries: BusinessOnDateEntry[]) {
  const newestFirst = sortBusinessEntries(entries, 'desc');
  const latest = newestFirst[0];

  return {
    cnr: caseData.cnr || '—',
    caseNumber: formatCaseNumberWithType(caseData),
    courtOf: latest?.courtOf || caseData.courtName || caseData.courtCode || '—',
    petitioner: latest?.petitioner || caseData.petitioners?.[0] || '—',
    respondent: latest?.respondent || caseData.respondents?.[0] || '—',
  };
}

export function getDailyBusinessPdfParties(caseData: CaseDetail, entries: BusinessOnDateEntry[]) {
  const petitioners = collectUniqueNames(
    caseData.petitioners,
    entries.map((entry) => entry.petitioner),
  );
  const respondents = collectUniqueNames(
    caseData.respondents,
    entries.map((entry) => entry.respondent),
  );

  return { petitioners, respondents };
}

function formatPartyListHtml(names: string[]): string {
  if (names.length === 0) return '—';
  if (names.length === 1) return cell(names[0]);
  return `<ol class="party-list">${names.map((name) => `<li>${cell(name)}</li>`).join('')}</ol>`;
}

export function buildDailyBusinessHtml(
  caseData: CaseDetail,
  entries: BusinessOnDateEntry[],
  fileNameContext?: PdfFileNameContext,
): string {
  const header = getDailyBusinessHeader(caseData, entries);
  const parties = getDailyBusinessPdfParties(caseData, entries);
  const documentTitle = fileNameContext
    ? buildPdfFileName('dailybusiness', caseData, fileNameContext)
    : `Daily Business - ${header.cnr}`;
  const rows = entries
    .map((entry, index) => {
      const courtOfValue = getCourtOfCellValue(entries, index);
      return `
      <tr>
        <td class="sno">${index + 1}</td>
        <td>${courtOfValue ? cell(courtOfValue) : ''}</td>
        <td>${cell(formatDisplayDate(entry.date))}</td>
        <td>${cell(entry.nextPurpose)}</td>
        <td class="business">${cell(entry.business)}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(documentTitle)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #2A2620; margin: 24px; background: #fff; }
    h1 { font-size: 22px; margin: 0 0 8px; color: #1C2B4A; text-align: center; }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px 28px;
      margin: 0 0 18px;
      font-size: 13px;
      line-height: 1.55;
      color: #6B6455;
    }
    .meta-grid strong { color: #1C2B4A; }
    .meta-item { margin: 0; }
    .party-list { margin: 4px 0 0 18px; padding: 0; }
    .party-list li { margin: 0 0 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #d7d0c1; padding: 8px; vertical-align: top; text-align: left; }
    th { background: #F6F1E6; color: #1C2B4A; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
    td.sno { width: 48px; text-align: center; }
    td.business { white-space: pre-wrap; word-break: break-word; }
    ${pdfBrandStripCss()}
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="has-site-strip">
  ${pdfBrandStripHtml()}
  <h1>Daily Business</h1>
  <div class="meta-grid">
    <p class="meta-item"><strong>CNR Number:</strong> ${cell(header.cnr)}</p>
    <p class="meta-item"><strong>Case Number:</strong> ${cell(header.caseNumber)}</p>
    <div class="meta-item">
      <strong>Petitioner(s):</strong>
      ${formatPartyListHtml(parties.petitioners)}
    </div>
    <div class="meta-item">
      <strong>Respondent(s):</strong>
      ${formatPartyListHtml(parties.respondents)}
    </div>
    <div class="meta-item">
      <strong>Petitioner's Advocate(s):</strong>
      ${formatPartyListHtml(collectUniqueNames(caseData.petitionerAdvocates))}
    </div>
    <div class="meta-item">
      <strong>Respondent's Advocate(s):</strong>
      ${formatPartyListHtml(collectUniqueNames(caseData.respondentAdvocates))}
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:6%">S No</th>
        <th style="width:18%">In Courts Of</th>
        <th style="width:12%">Date</th>
        <th style="width:16%">Next Purpose</th>
        <th>Business</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5">No daily business entries available.</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

/** Print / Save-as-PDF using a hidden iframe (no popup window). */
export function printDailyBusinessDocument(
  caseData: CaseDetail,
  entries: BusinessOnDateEntry[],
  fileNameContext?: PdfFileNameContext,
) {
  const html = buildDailyBusinessHtml(caseData, entries, fileNameContext);
  const fileName = fileNameContext
    ? buildPdfFileName('dailybusiness', caseData, fileNameContext)
    : 'Daily Business PDF';
  printHtmlDocument(fileName, html);
}
