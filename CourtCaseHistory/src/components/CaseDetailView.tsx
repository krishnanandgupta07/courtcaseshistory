import { useMemo, useState, type ReactNode } from 'react';
import { formatCaseNumberWithType, formatDisplayDate } from '../api/ecourts';
import type {
  BusinessOnDateEntry,
  CaseDetail,
  CaseFile,
  CaseHearing,
  CaseOrder,
} from '../types/ecourts';
import {
  buildCaseHistoryHtml,
  buildOrdersHtml,
  printCaseHistoryDocument,
  printOrdersDocument,
  sortHearings,
  sortOrders,
  type DateSortOrder,
} from '../utils/caseReportPdf';
import {
  buildDailyBusinessHtml,
  getCourtOfCellValue,
  getDailyBusinessHeader,
  printDailyBusinessDocument,
  sortBusinessEntries,
} from '../utils/dailyBusinessPdf';

type TabId =
  | 'details'
  | 'orders'
  | 'listings'
  | 'daily-business'
  | 'misc'
  | 'connected'
  | 'lower';

const tabs: { id: TabId; label: string }[] = [
  { id: 'details', label: 'Case Details' },
  { id: 'orders', label: 'Orders/Judgments' },
  { id: 'listings', label: 'Case History' },
  { id: 'daily-business', label: 'Daily Business' },
  { id: 'misc', label: 'Misc. Info' },
  { id: 'connected', label: 'Conn. Matters' },
  { id: 'lower', label: 'Lower Court Details' },
];

function display(value?: string | null): string {
  if (!value || !String(value).trim()) return '—';
  return String(value);
}

function PartyList({ items, empty = '—' }: { items?: string[]; empty?: string }) {
  if (!items || items.length === 0) {
    return <span className="text-inkSoft">{empty}</span>;
  }

  return (
    <ul className="space-y-1">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex items-start gap-2">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy/10 text-[10px] font-semibold text-navy">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 border-b border-navy/10 py-2 sm:grid-cols-[180px_1fr] sm:gap-3">
      <dt className="text-sm font-semibold text-navy">{label}</dt>
      <dd className="text-sm text-ink">{children}</dd>
    </div>
  );
}

function EmptyBlock({ message }: { message: string }) {
  return (
    <p className="rounded-sm border border-dashed border-navy/15 bg-parchment/60 px-4 py-6 text-center text-sm text-inkSoft">
      {message}
    </p>
  );
}

function isEmptyRecord(value?: Record<string, unknown> | null): boolean {
  if (!value) return true;
  return Object.values(value).every((entry) => {
    if (entry == null) return true;
    if (typeof entry === 'string') return !entry.trim();
    if (Array.isArray(entry)) return entry.length === 0;
    if (typeof entry === 'object') return Object.keys(entry as object).length === 0;
    return false;
  });
}

function findOrderFile(order: CaseOrder, files: CaseFile[]): CaseFile | undefined {
  if (!files.length) return undefined;
  const url = (order.orderUrl || '').toLowerCase();
  if (!url) return files[0];

  return (
    files.find((file) => {
      const pdf = (file.pdfFile || '').toLowerCase();
      const md = (file.markdownFile || '').toLowerCase();
      return pdf.includes(url.replace('.pdf', '')) || md.includes(url.replace('.pdf', '')) || pdf.endsWith(url);
    }) ?? files.find((file) => Boolean(file.markdownContent))
  );
}

function CaseDetailsTab({ caseData }: { caseData: CaseDetail }) {
  const status = display(caseData.caseStatus);
  const isDisposed = /dispos/i.test(status);

  return (
    <dl>
      <DetailRow label="District">{display(caseData.district)}</DetailRow>
      <DetailRow label="State">{display(caseData.state)}</DetailRow>
      <DetailRow label="Court">{display(caseData.courtName || caseData.courtCode)}</DetailRow>
      <DetailRow label="Bench">{display(caseData.benchName)}</DetailRow>
      <DetailRow label="Case Type">
        {display(caseData.caseTypeRaw || caseData.caseType)}
        {caseData.caseTypeSub ? (
          <span className="mt-1 block text-inkSoft">{caseData.caseTypeSub}</span>
        ) : null}
      </DetailRow>
      <DetailRow label="Filing / Stamp Number">{display(caseData.filingNumber)}</DetailRow>
      <DetailRow label="Filing Date">{formatDisplayDate(caseData.filingDate)}</DetailRow>
      <DetailRow label="Registration Number">{display(caseData.registrationNumber)}</DetailRow>
      <DetailRow label="Registration Date">{formatDisplayDate(caseData.registrationDate)}</DetailRow>
      <DetailRow label="Disposal / Decision Date">{formatDisplayDate(caseData.decisionDate)}</DetailRow>
      <DetailRow label="Disposal Type">{display(caseData.disposalType)}</DetailRow>
      <DetailRow label="Status">
        <span className={isDisposed ? 'font-semibold text-burgundy' : 'font-semibold text-sage'}>
          {status}
        </span>
      </DetailRow>
      <DetailRow label="Petitioner">
        <PartyList items={caseData.petitioners} />
      </DetailRow>
      <DetailRow label="Respondent">
        <PartyList items={caseData.respondents} />
      </DetailRow>
      <DetailRow label="Petitioner's Advocate">
        <PartyList items={caseData.petitionerAdvocates} />
      </DetailRow>
      <DetailRow label="Respondent's Advocate">
        <PartyList items={caseData.respondentAdvocates} />
      </DetailRow>
      <DetailRow label="Last Date">{formatDisplayDate(caseData.lastHearingDate)}</DetailRow>
      <DetailRow label="Next Hearing">{formatDisplayDate(caseData.nextHearingDate)}</DetailRow>
      <DetailRow label="Stage / Purpose">{display(caseData.purpose)}</DetailRow>
      <DetailRow label="Last Coram">
        <PartyList items={caseData.judges} />
      </DetailRow>
      <DetailRow label="Category">{display(caseData.caseCategoryFacetPath)}</DetailRow>
      <DetailRow label="Judicial Section">{display(caseData.judicialSection)}</DetailRow>
      <DetailRow label="Contested Status">{display(caseData.contestedStatus)}</DetailRow>
    </dl>
  );
}

function SortPdfControls(props: {
  sortOrder: DateSortOrder;
  onSortChange: (order: DateSortOrder) => void;
  onShowPdf: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <div
        className="inline-flex overflow-hidden rounded-sm border border-navy/20"
        role="group"
        aria-label="Sort by date"
      >
        <button
          type="button"
          aria-pressed={props.sortOrder === 'desc'}
          onClick={() => props.onSortChange('desc')}
          className={`min-h-9 px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
            props.sortOrder === 'desc'
              ? 'bg-brass text-navyDeep'
              : 'bg-white text-navy hover:bg-parchment'
          }`}
        >
          DESC
        </button>
        <button
          type="button"
          aria-pressed={props.sortOrder === 'asc'}
          onClick={() => props.onSortChange('asc')}
          className={`min-h-9 border-l border-navy/20 px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
            props.sortOrder === 'asc'
              ? 'bg-brass text-navyDeep'
              : 'bg-white text-navy hover:bg-parchment'
          }`}
        >
          ASC
        </button>
      </div>
      <button
        type="button"
        onClick={props.onShowPdf}
        className="inline-flex min-h-9 items-center rounded-sm border border-navy/20 bg-white px-3 text-xs font-semibold text-navy transition hover:bg-parchment focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
      >
        PDF
      </button>
    </div>
  );
}

function PdfPreviewModal(props: {
  open: boolean;
  title: string;
  html: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  if (!props.open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navyDeep/60 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={props.title}
    >
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-sm border border-navy/20 bg-parchment shadow-slip">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy/10 px-4 py-3">
          <h4 className="font-display text-lg text-navy">{props.title}</h4>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={props.onPrint}
              className="inline-flex min-h-9 items-center rounded-sm bg-navy px-3 text-xs font-semibold text-parchment transition hover:bg-navyDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              Print / Save PDF
            </button>
            <button
              type="button"
              onClick={props.onClose}
              className="inline-flex min-h-9 items-center rounded-sm border border-navy/20 bg-white px-3 text-xs font-semibold text-navy transition hover:bg-parchmentDim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
            >
              Close
            </button>
          </div>
        </div>
        <iframe
          title={props.title}
          className="h-full w-full flex-1 bg-white"
          srcDoc={props.html}
        />
      </div>
    </div>
  );
}

function OrdersTab({ caseData }: { caseData: CaseDetail }) {
  const orders = useMemo(
    () => [...(caseData.judgmentOrders ?? []), ...(caseData.interimOrders ?? [])],
    [caseData.judgmentOrders, caseData.interimOrders],
  );
  const files = caseData.files ?? [];
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<DateSortOrder>('desc');

  const sortedOrders = useMemo(() => sortOrders(orders, sortOrder), [orders, sortOrder]);

  const ordersForPdf = useMemo(
    () =>
      sortedOrders.map((order) => {
        const file = findOrderFile(order, files);
        return {
          ...order,
          orderUrl: file?.pdfFile || order.orderUrl,
        };
      }),
    [sortedOrders, files],
  );

  const previewHtml = useMemo(
    () => buildOrdersHtml(caseData, ordersForPdf),
    [caseData, ordersForPdf],
  );

  function handleShowPdf() {
    setPdfError(null);
    setPreviewOpen(true);
  }

  function handleDownloadPdf() {
    setPdfError(null);
    try {
      printOrdersDocument(caseData, ordersForPdf);
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : 'Unable to open print dialog. Use Show PDF, then print from there.',
      );
    }
  }

  if (orders.length === 0 && files.length === 0) {
    return <EmptyBlock message="No orders or judgments available for this case." />;
  }

  return (
    <div className="space-y-4">
      {orders.length > 0 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-inkSoft">
              Sorted by date: {sortOrder === 'desc' ? 'newest first (DESC)' : 'oldest first (ASC)'}.
              PDF uses the same order.
            </p>
            <SortPdfControls
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              onShowPdf={handleShowPdf}
            />
          </div>

          {pdfError ? (
            <p
              className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              {pdfError}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-inkSoft">
                  <th className="px-2 py-2 font-semibold">S No</th>
                  <th className="px-2 py-2 font-semibold">Order Date</th>
                  <th className="px-2 py-2 font-semibold">Type</th>
                  <th className="px-2 py-2 font-semibold">Document</th>
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((order, index) => {
                  const file = findOrderFile(order, files);
                  return (
                    <tr
                      key={`${order.orderDate}-${order.orderType}-${index}`}
                      className="border-b border-navy/10"
                    >
                      <td className="whitespace-nowrap px-2 py-3 text-center text-inkSoft">
                        {index + 1}
                      </td>
                      <td className="px-2 py-3 text-ink">{formatDisplayDate(order.orderDate)}</td>
                      <td className="px-2 py-3 text-ink">{display(order.orderType)}</td>
                      <td className="px-2 py-3 text-inkSoft">
                        {file?.pdfFile || order.orderUrl || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PdfPreviewModal
            open={previewOpen}
            title="Orders / Judgments PDF Preview"
            html={previewHtml}
            onClose={() => setPreviewOpen(false)}
            onPrint={handleDownloadPdf}
          />
        </>
      ) : null}

      {files.map((file, index) =>
        file.markdownContent ? (
          <details
            key={`${file.pdfFile || file.markdownFile || index}`}
            className="rounded-sm border border-navy/10 bg-parchment open:shadow-slip"
          >
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-navy">
              Judgment / Order text
              {file.pdfFile ? ` (${file.pdfFile})` : ''}
            </summary>
            <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap border-t border-navy/10 bg-white/40 px-4 py-3 font-mono text-xs leading-relaxed text-ink">
              {file.markdownContent}
            </pre>
          </details>
        ) : null,
      )}
    </div>
  );
}

function ListingsTab({ caseData }: { caseData: CaseDetail }) {
  const hearings = caseData.historyOfCaseHearings ?? [];
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<DateSortOrder>('desc');

  const sortedHearings = useMemo(
    () => sortHearings(hearings, sortOrder),
    [hearings, sortOrder],
  );

  const previewHtml = useMemo(
    () => buildCaseHistoryHtml(caseData, sortedHearings),
    [caseData, sortedHearings],
  );

  function handleShowPdf() {
    setPdfError(null);
    setPreviewOpen(true);
  }

  function handleDownloadPdf() {
    setPdfError(null);
    try {
      printCaseHistoryDocument(caseData, sortedHearings);
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : 'Unable to open print dialog. Use Show PDF, then print from there.',
      );
    }
  }

  if (hearings.length === 0) {
    return <EmptyBlock message="No listing or hearing history available." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-inkSoft">
          Sorted by date: {sortOrder === 'desc' ? 'newest first (DESC)' : 'oldest first (ASC)'}. PDF
          uses the same order.
        </p>
        <SortPdfControls
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onShowPdf={handleShowPdf}
        />
      </div>

      {pdfError ? (
        <p
          className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
          role="alert"
        >
          {pdfError}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-inkSoft">
              <th className="px-2 py-2 font-semibold">S No</th>
              <th className="px-2 py-2 font-semibold">Date</th>
              <th className="px-2 py-2 font-semibold">Cause List</th>
              <th className="px-2 py-2 font-semibold">Judge / Coram</th>
              <th className="px-2 py-2 font-semibold">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {sortedHearings.map((hearing: CaseHearing, index) => (
              <tr
                key={`${hearing.hearingDate || hearing.businessOnDate}-${index}`}
                className="border-b border-navy/10"
              >
                <td className="whitespace-nowrap px-2 py-3 text-center text-inkSoft">{index + 1}</td>
                <td className="px-2 py-3">
                  {formatDisplayDate(hearing.hearingDate || hearing.businessOnDate)}
                </td>
                <td className="px-2 py-3">{display(hearing.causeListType)}</td>
                <td className="px-2 py-3">{display(hearing.judge)}</td>
                <td className="px-2 py-3">{display(hearing.purposeOfListing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PdfPreviewModal
        open={previewOpen}
        title="Case History PDF Preview"
        html={previewHtml}
        onClose={() => setPreviewOpen(false)}
        onPrint={handleDownloadPdf}
      />
    </div>
  );
}

function DailyBusinessTab({ caseData }: { caseData: CaseDetail }) {
  const entries = caseData.businessOnDateEntries ?? [];
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<DateSortOrder>('desc');

  const header = useMemo(() => getDailyBusinessHeader(caseData, entries), [caseData, entries]);

  const sortedEntries = useMemo(
    () => sortBusinessEntries(entries, sortOrder),
    [entries, sortOrder],
  );

  const previewHtml = useMemo(
    () => buildDailyBusinessHtml(caseData, sortedEntries),
    [caseData, sortedEntries],
  );

  function handleShowPdf() {
    setPdfError(null);
    setPreviewOpen(true);
  }

  function handleDownloadPdf() {
    setPdfError(null);
    try {
      printDailyBusinessDocument(caseData, sortedEntries);
    } catch (error) {
      setPdfError(
        error instanceof Error
          ? error.message
          : 'Unable to open print dialog. Use Show PDF, then print from there.',
      );
    }
  }

  if (entries.length === 0) {
    return <EmptyBlock message="No daily business entries available for this case." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-sm border border-navy/10 bg-parchment px-4 py-3">
        <dl className="grid flex-1 gap-1 text-sm text-ink sm:grid-cols-2">
          <div>
            <dt className="inline font-semibold text-navy">CNR Number: </dt>
            <dd className="inline font-mono">{header.cnr}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-navy">Case Number: </dt>
            <dd className="inline">{header.caseNumber}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="inline font-semibold text-navy">In courts of: </dt>
            <dd className="inline">{header.courtOf}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-navy">Petitioner: </dt>
            <dd className="inline">{header.petitioner}</dd>
          </div>
          <div>
            <dt className="inline font-semibold text-navy">Respondent: </dt>
            <dd className="inline">{header.respondent}</dd>
          </div>
        </dl>

        <SortPdfControls
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          onShowPdf={handleShowPdf}
        />
      </div>

      <p className="text-xs text-inkSoft">
        Sorted by date: {sortOrder === 'desc' ? 'newest first (DESC)' : 'oldest first (ASC)'}. PDF uses
        the same order.
      </p>

      {pdfError ? (
        <p className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy" role="alert">
          {pdfError}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-inkSoft">
              <th className="px-2 py-2 font-semibold">S No</th>
              <th className="px-2 py-2 font-semibold">In Courts Of</th>
              <th className="px-2 py-2 font-semibold">Date</th>
              <th className="px-2 py-2 font-semibold">Next Purpose</th>
              <th className="px-2 py-2 font-semibold">Business</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map((entry: BusinessOnDateEntry, index) => (
              <tr key={`${entry.date}-${entry.nextHearingDate}-${index}`} className="border-b border-navy/10 align-top">
                <td className="whitespace-nowrap px-2 py-3 text-center text-inkSoft">{index + 1}</td>
                <td className="px-2 py-3">{getCourtOfCellValue(sortedEntries, index)}</td>
                <td className="whitespace-nowrap px-2 py-3">{formatDisplayDate(entry.date)}</td>
                <td className="px-2 py-3">{display(entry.nextPurpose)}</td>
                <td className="max-w-xl px-2 py-3 leading-relaxed">{display(entry.business)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PdfPreviewModal
        open={previewOpen}
        title="Daily Business PDF Preview"
        html={previewHtml}
        onClose={() => setPreviewOpen(false)}
        onPrint={handleDownloadPdf}
      />
    </div>
  );
}

function MiscTab({ caseData }: { caseData: CaseDetail }) {
  const ias = caseData.interlocutoryApplications ?? [];
  const notices = caseData.notices ?? [];

  if (ias.length === 0 && notices.length === 0) {
    return <EmptyBlock message="No miscellaneous information available." />;
  }

  return (
    <div className="space-y-6">
      <section>
        <h4 className="mb-2 font-display text-lg text-navy">Interlocutory Applications</h4>
        {ias.length === 0 ? (
          <EmptyBlock message="No interlocutory applications." />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-navy/15 text-xs uppercase tracking-wide text-inkSoft">
                  <th className="px-2 py-2 font-semibold">Registration</th>
                  <th className="px-2 py-2 font-semibold">Particular</th>
                  <th className="px-2 py-2 font-semibold">Filed By</th>
                  <th className="px-2 py-2 font-semibold">Filing Date</th>
                  <th className="px-2 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {ias.map((ia, index) => (
                  <tr key={`${ia.regNo}-${index}`} className="border-b border-navy/10">
                    <td className="px-2 py-3">{display(ia.regNo)}</td>
                    <td className="px-2 py-3">{display(ia.particular)}</td>
                    <td className="px-2 py-3">{display(ia.filedBy)}</td>
                    <td className="px-2 py-3">{formatDisplayDate(ia.filingDate)}</td>
                    <td className="px-2 py-3">{display(ia.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h4 className="mb-2 font-display text-lg text-navy">Notices</h4>
        {notices.length === 0 ? (
          <EmptyBlock message="No notices available." />
        ) : (
          <ul className="space-y-2 text-sm text-ink">
            {notices.map((notice, index) => (
              <li key={index} className="rounded-sm border border-navy/10 bg-parchment px-3 py-2">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {typeof notice === 'string' ? notice : JSON.stringify(notice, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConnectedTab({ caseData }: { caseData: CaseDetail }) {
  const links = caseData.linkCases ?? [];
  if (links.length === 0) {
    return <EmptyBlock message="No connected matters available." />;
  }

  return (
    <ul className="space-y-2 text-sm text-ink">
      {links.map((item, index) => (
        <li key={index} className="rounded-sm border border-navy/10 bg-parchment px-3 py-2">
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
          </pre>
        </li>
      ))}
    </ul>
  );
}

function LowerCourtTab({ caseData }: { caseData: CaseDetail }) {
  const earlier = caseData.earlierCourtDetails ?? [];
  const subordinate = caseData.subordinateCourt;
  const fir = caseData.firDetails;

  if (earlier.length === 0 && isEmptyRecord(subordinate) && isEmptyRecord(fir)) {
    return <EmptyBlock message="No lower court details available." />;
  }

  return (
    <div className="space-y-4 text-sm text-ink">
      {earlier.length > 0 ? (
        <section>
          <h4 className="mb-2 font-display text-lg text-navy">Earlier Court Details</h4>
          <ul className="space-y-2">
            {earlier.map((item, index) => (
              <li key={index} className="rounded-sm border border-navy/10 bg-parchment px-3 py-2">
                <pre className="whitespace-pre-wrap font-mono text-xs">
                  {typeof item === 'string' ? item : JSON.stringify(item, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!isEmptyRecord(subordinate) ? (
        <section>
          <h4 className="mb-2 font-display text-lg text-navy">Subordinate Court</h4>
          <pre className="overflow-auto rounded-sm border border-navy/10 bg-parchment px-3 py-2 font-mono text-xs">
            {JSON.stringify(subordinate, null, 2)}
          </pre>
        </section>
      ) : null}

      {!isEmptyRecord(fir) ? (
        <section>
          <h4 className="mb-2 font-display text-lg text-navy">FIR Details</h4>
          <pre className="overflow-auto rounded-sm border border-navy/10 bg-parchment px-3 py-2 font-mono text-xs">
            {JSON.stringify(fir, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}

type Props = {
  caseData: CaseDetail;
};

export function CaseDetailView({ caseData }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('details');

  const petitioners = useMemo(
    () => (caseData.petitioners ?? []).filter(Boolean),
    [caseData.petitioners],
  );
  const respondents = useMemo(
    () => (caseData.respondents ?? []).filter(Boolean),
    [caseData.respondents],
  );

  const summary = useMemo(() => {
    const caseNo = formatCaseNumberWithType(caseData);
    const filedOn = formatDisplayDate(caseData.filingDate);
    const court = caseData.courtName || caseData.courtCode || 'Court';
    return `Case No. ${caseNo} with CNR No. ${caseData.cnr || '—'}, was filed on ${filedOn} at ${court}.`;
  }, [caseData]);

  return (
    <article className="overflow-hidden rounded-sm border border-navy/10 bg-parchment shadow-slip">
      <div className="border-b border-navy/10 bg-white/50 px-3 py-2 sm:px-4">
        <p className="text-xs leading-relaxed text-inkSoft sm:text-sm">{summary}</p>

        <div className="mt-2 grid gap-2 sm:grid-cols-2 sm:gap-4">
          <div className="rounded-sm border border-navy/10 bg-parchment/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy">Petitioner(s)</p>
            {petitioners.length > 0 ? (
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-ink">
                {petitioners.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-inkSoft">—</p>
            )}
          </div>

          <div className="rounded-sm border border-navy/10 bg-parchment/70 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-navy">Respondent(s)</p>
            {respondents.length > 0 ? (
              <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-sm text-ink">
                {respondents.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ol>
            ) : (
              <p className="mt-1 text-sm text-inkSoft">—</p>
            )}
          </div>
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Case information sections"
        className="flex flex-wrap gap-1.5 border-b border-navy/10 bg-navy/[0.03] px-3 py-2 sm:px-4"
      >
        {tabs.map((tab) => {
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-8 rounded-full px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass sm:text-sm ${
                selected
                  ? 'bg-brass text-navyDeep'
                  : 'bg-white/70 text-navy hover:bg-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" className="bg-white/40 px-3 py-3 sm:px-4 sm:py-4">
        {activeTab === 'details' ? <CaseDetailsTab caseData={caseData} /> : null}
        {activeTab === 'orders' ? <OrdersTab caseData={caseData} /> : null}
        {activeTab === 'listings' ? <ListingsTab caseData={caseData} /> : null}
        {activeTab === 'daily-business' ? <DailyBusinessTab caseData={caseData} /> : null}
        {activeTab === 'misc' ? <MiscTab caseData={caseData} /> : null}
        {activeTab === 'connected' ? <ConnectedTab caseData={caseData} /> : null}
        {activeTab === 'lower' ? <LowerCourtTab caseData={caseData} /> : null}
      </div>
    </article>
  );
}
