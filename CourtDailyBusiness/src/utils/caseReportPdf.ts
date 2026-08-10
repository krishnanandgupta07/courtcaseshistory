import { formatCaseNumberWithType, formatDisplayDate } from '../api/ecourts';
import type { CaseDetail, CaseHearing, CaseOrder } from '../types/ecourts';
import { pdfBrandStripCss, pdfBrandStripHtml } from './pdfBrandStrip';

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
  return [...items].sort((a, b) => {
    const left = getDate(a) || '';
    const right = getDate(b) || '';
    const compared = left.localeCompare(right);
    return order === 'asc' ? compared : -compared;
  });
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
  <title>${escapeHtml(options.title)} - ${escapeHtml(meta.cnr)}</title>
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

/** Print / Save-as-PDF using a hidden iframe (no popup window). */
export function printHtmlDocument(title: string, html: string) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', title);
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
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

  const cleanup = () => {
    if (iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  };

  const triggerPrint = () => {
    try {
      frameWindow.focus();
      frameWindow.print();
    } finally {
      window.setTimeout(cleanup, 1500);
    }
  };

  window.setTimeout(triggerPrint, 250);
}

export function sortOrders(orders: CaseOrder[], order: DateSortOrder): CaseOrder[] {
  return sortByDateValue(orders, (item) => item.orderDate, order);
}

export function sortHearings(hearings: CaseHearing[], order: DateSortOrder): CaseHearing[] {
  return sortByDateValue(
    hearings,
    (item) => item.hearingDate || item.businessOnDate,
    order,
  );
}

export function buildOrdersHtml(caseData: CaseDetail, orders: CaseOrder[]): string {
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

export function printOrdersDocument(caseData: CaseDetail, orders: CaseOrder[]) {
  printHtmlDocument('Orders / Judgments PDF', buildOrdersHtml(caseData, orders));
}

export function buildCaseHistoryHtml(caseData: CaseDetail, hearings: CaseHearing[]): string {
  const rows = hearings
    .map(
      (hearing, index) => `
      <tr>
        <td class="sno">${index + 1}</td>
        <td>${cell(formatDisplayDate(hearing.hearingDate || hearing.businessOnDate))}</td>
        <td>${cell(hearing.causeListType)}</td>
        <td>${cell(hearing.judge)}</td>
        <td class="wrap">${cell(hearing.purposeOfListing)}</td>
      </tr>`,
    )
    .join('');

  return wrapCaseReportHtml({
    title: 'Case History',
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

export function printCaseHistoryDocument(caseData: CaseDetail, hearings: CaseHearing[]) {
  printHtmlDocument('Case History PDF', buildCaseHistoryHtml(caseData, hearings));
}
