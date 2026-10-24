import { formatCaseNumberWithType, formatDisplayDate } from '../api/ecourts';
import type { CaseDetail, CaseHearing, CaseOrder } from '../types/ecourts';
import { courtOrderSheetCss, formatCourtOrderHtml } from './courtOrderHtml';
import { pdfBrandStripCss, pdfBrandStripHtml } from './pdfBrandStrip';
import { buildPdfFileName, type PdfFileNameContext } from './pdfFileName';

export type { PdfFileNameContext } from './pdfFileName';

export type DateSortOrder = 'asc' | 'desc';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function cell(value?: string | null): string {
  if (!value || !String(value).trim()) return '—';
  return escapeHtml(String(value));
}

export function sortByDateValue<T>(
  items: T[],
  getDate: (item: T) => string | undefined | null,
  order: DateSortOrder,
): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const left = getDate(a.item) || '';
      const right = getDate(b.item) || '';
      const compared = left.localeCompare(right);
      if (compared !== 0) {
        return order === 'asc' ? compared : -compared;
      }
      // Same calendar date: later API rows are the more recent events.
      return order === 'asc' ? a.index - b.index : b.index - a.index;
    })
    .map(({ item }) => item);
}

/** Actual hearing date. `hearingDate` is the next listing, not this event. */
export function getHearingEventDate(hearing: CaseHearing): string | undefined {
  return hearing.businessOnDate || hearing.hearingDate;
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

export function getCaseReportMeta(caseData: CaseDetail) {
  return {
    cnr: caseData.cnr || '—',
    caseNumber: formatCaseNumberWithType(caseData),
    court: caseData.courtName || caseData.courtCode || '—',
    petitioners: collectUniqueNames(caseData.petitioners),
    respondents: collectUniqueNames(caseData.respondents),
    petitionerAdvocates: collectUniqueNames(caseData.petitionerAdvocates),
    respondentAdvocates: collectUniqueNames(caseData.respondentAdvocates),
  };
}

function formatPartyListHtml(names: string[]): string {
  if (names.length === 0) return '—';
  if (names.length === 1) return cell(names[0]);
  return `<ol class="party-list">${names.map((name) => `<li>${cell(name)}</li>`).join('')}</ol>`;
}

export function wrapCaseReportHtml(options: {
  title: string;
  documentTitle: string;
  caseData: CaseDetail;
  tableHead: string;
  tableBody: string;
  emptyColSpan: number;
  emptyMessage: string;
}): string {
  const meta = getCaseReportMeta(options.caseData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.documentTitle)}</title>
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
    td.wrap { white-space: pre-wrap; word-break: break-word; }
    ${pdfBrandStripCss()}
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="has-site-strip">
  ${pdfBrandStripHtml()}
  <h1>${escapeHtml(options.title)}</h1>
  <div class="meta-grid">
    <p class="meta-item"><strong>CNR Number:</strong> ${cell(meta.cnr)}</p>
    <p class="meta-item"><strong>Case Number:</strong> ${cell(meta.caseNumber)}</p>
    <div class="meta-item">
      <strong>Petitioner(s):</strong>
      ${formatPartyListHtml(meta.petitioners)}
    </div>
    <div class="meta-item">
      <strong>Respondent(s):</strong>
      ${formatPartyListHtml(meta.respondents)}
    </div>
    <div class="meta-item">
      <strong>Petitioner's Advocate(s):</strong>
      ${formatPartyListHtml(meta.petitionerAdvocates)}
    </div>
    <div class="meta-item">
      <strong>Respondent's Advocate(s):</strong>
      ${formatPartyListHtml(meta.respondentAdvocates)}
    </div>
  </div>
  <table>
    <thead>
      <tr>${options.tableHead}</tr>
    </thead>
    <tbody>
      ${
        options.tableBody ||
        `<tr><td colspan="${options.emptyColSpan}">${escapeHtml(options.emptyMessage)}</td></tr>`
      }
    </tbody>
  </table>
</body>
</html>`;
}

/** Print / Save-as-PDF using a hidden iframe (no popup window).
 * Chrome's "Save as PDF" uses the top-level document title as the file name. */
export function printHtmlDocument(title: string, html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.style.position = 'fixed';
  iframe.style.left = '-10000px';
  iframe.style.top = '0';
  iframe.style.width = '830px';
  iframe.style.height = '1100px';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    document.body.removeChild(iframe);
    throw new Error('Unable to prepare the PDF document in this browser.');
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();
  frameDocument.title = title;

  const previousTitle = document.title;
  document.title = title;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.removeEventListener('afterprint', finish);
    frameWindow.removeEventListener('afterprint', finish);
    // Keep the custom title until Chrome's Save As dialog has copied it.
    window.setTimeout(() => {
      document.title = previousTitle;
      if (iframe.parentNode) {
        iframe.parentNode.removeChild(iframe);
      }
    }, 10000);
  };

  window.addEventListener('afterprint', finish);
  frameWindow.addEventListener('afterprint', finish);

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } catch (error) {
      finish();
      throw error instanceof Error
        ? error
        : new Error('Unable to open print dialog.');
    }
    window.setTimeout(finish, 120000);
  };

  window.setTimeout(triggerPrint, 250);
}

export function sortOrders(orders: CaseOrder[], order: DateSortOrder): CaseOrder[] {
  return sortByDateValue(orders, (item) => item.orderDate, order);
}

export function sortHearings(hearings: CaseHearing[], order: DateSortOrder): CaseHearing[] {
  return sortByDateValue(hearings, getHearingEventDate, order);
}

export function buildOrdersHtml(
  caseData: CaseDetail,
  orders: CaseOrder[],
  fileNameContext?: PdfFileNameContext,
): string {
  const rows = orders
    .map(
      (order, index) => `
      <tr>
        <td class="sno">${index + 1}</td>
        <td>${cell(formatDisplayDate(order.orderDate))}</td>
        <td>${cell(order.orderType)}</td>
        <td class="wrap">${cell(order.orderUrl)}</td>
      </tr>`,
    )
    .join('');

  return wrapCaseReportHtml({
    title: 'Orders / Judgments',
    documentTitle: fileNameContext
      ? buildPdfFileName('orders', caseData, fileNameContext)
      : `Orders / Judgments - ${caseData.cnr || 'case'}`,
    caseData,
    tableHead: `
      <th style="width:6%">S No</th>
      <th style="width:16%">Order Date</th>
      <th style="width:20%">Type</th>
      <th>Document</th>`,
    tableBody: rows,
    emptyColSpan: 4,
    emptyMessage: 'No orders or judgments available.',
  });
}

export function printOrdersDocument(
  caseData: CaseDetail,
  orders: CaseOrder[],
  fileNameContext?: PdfFileNameContext,
) {
  const html = buildOrdersHtml(caseData, orders, fileNameContext);
  const fileName = fileNameContext
    ? buildPdfFileName('orders', caseData, fileNameContext)
    : 'Orders / Judgments PDF';
  printHtmlDocument(fileName, html);
}

export function buildOrderFileHtml(
  caseData: CaseDetail,
  options: {
    documentTitle: string;
    heading: string;
    orderDate?: string;
    orderType?: string;
    body?: string;
  },
): string {
  const meta = getCaseReportMeta(caseData);
  const body = (options.body || '').trim();
  const orderHtml = body
    ? formatCourtOrderHtml(body)
    : '<p class="order-para">No order text is available for this document.</p>';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(options.documentTitle)}</title>
  <style>
    body { font-family: 'Times New Roman', Times, Georgia, serif; color: #2A2620; margin: 24px; background: #fff; }
    h1 { font-size: 20px; margin: 0 0 8px; color: #1C2B4A; text-align: center; }
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
    ${courtOrderSheetCss()}
    ${pdfBrandStripCss()}
    @media print {
      .no-print { display: none !important; }
    }
  </style>
</head>
<body class="has-site-strip">
  ${pdfBrandStripHtml()}
  <h1>${escapeHtml(options.heading)}</h1>
  <div class="meta-grid">
    <p class="meta-item"><strong>CNR Number:</strong> ${cell(meta.cnr)}</p>
    <p class="meta-item"><strong>Case Number:</strong> ${cell(meta.caseNumber)}</p>
    <p class="meta-item"><strong>Order Date:</strong> ${cell(formatDisplayDate(options.orderDate))}</p>
    <p class="meta-item"><strong>Type:</strong> ${cell(options.orderType)}</p>
    <div class="meta-item">
      <strong>Petitioner(s):</strong>
      ${formatPartyListHtml(meta.petitioners)}
    </div>
    <div class="meta-item">
      <strong>Respondent(s):</strong>
      ${formatPartyListHtml(meta.respondents)}
    </div>
  </div>
  <article class="order-sheet">${orderHtml}</article>
</body>
</html>`;
}

export function printOrderFileDocument(title: string, html: string) {
  printHtmlDocument(title, html);
}

export function buildCaseHistoryHtml(
  caseData: CaseDetail,
  hearings: CaseHearing[],
  fileNameContext?: PdfFileNameContext,
): string {
  const rows = hearings
    .map(
      (hearing, index) => `
      <tr>
        <td class="sno">${index + 1}</td>
        <td>${cell(formatDisplayDate(getHearingEventDate(hearing)))}</td>
        <td>${cell(hearing.causeListType)}</td>
        <td>${cell(hearing.judge)}</td>
        <td class="wrap">${cell(hearing.purposeOfListing)}</td>
      </tr>`,
    )
    .join('');

  return wrapCaseReportHtml({
    title: 'Case History',
    documentTitle: fileNameContext
      ? buildPdfFileName('casehistory', caseData, fileNameContext)
      : `Case History - ${caseData.cnr || 'case'}`,
    caseData,
    tableHead: `
      <th style="width:6%">S No</th>
      <th style="width:14%">Date</th>
      <th style="width:18%">Cause List</th>
      <th style="width:22%">Judge / Coram</th>
      <th>Purpose</th>`,
    tableBody: rows,
    emptyColSpan: 5,
    emptyMessage: 'No listing or hearing history available.',
  });
}

export function printCaseHistoryDocument(
  caseData: CaseDetail,
  hearings: CaseHearing[],
  fileNameContext?: PdfFileNameContext,
) {
  const html = buildCaseHistoryHtml(caseData, hearings, fileNameContext);
  const fileName = fileNameContext
    ? buildPdfFileName('casehistory', caseData, fileNameContext)
    : 'Case History PDF';
  printHtmlDocument(fileName, html);
}
