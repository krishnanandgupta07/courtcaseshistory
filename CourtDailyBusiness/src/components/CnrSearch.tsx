import { useId, useRef, useState, type FormEvent } from 'react';
import {
  fetchCaseByCnr,
  getErrorMessage,
  refreshCaseByCnr,
  waitMs,
} from '../api/ecourts';
import type { CaseDetail } from '../types/ecourts';
import { AutoDismissToast } from './AutoDismissToast';
import { CaseDetailView } from './CaseDetailView';

const fieldClass =
  'w-full min-w-0 rounded-sm border border-navy/15 bg-parchment px-3 py-1.5 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 disabled:cursor-not-allowed disabled:opacity-60';

/** eCourts CNR is typically 16 alphanumeric characters (no spaces/hyphens). */
const CNR_PATTERN = /^[A-Z0-9]{16}$/;

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-inkSoft" role="status">
      <span
        className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brass/30 border-t-brass"
        aria-hidden
      />
      {label}
    </span>
  );
}

export function CnrSearch({ initialCnr = '' }: { initialCnr?: string }) {
  const formId = useId();
  const [cnr, setCnr] = useState(initialCnr);
  const [searching, setSearching] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaseDetail | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDataReadyToast, setShowDataReadyToast] = useState(false);
  const refreshGenerationRef = useRef(0);

  const normalizedPreview = cnr.replace(/[\s-]/g, '').toUpperCase();
  const canSubmit = Boolean(normalizedPreview) && !searching;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const generation = ++refreshGenerationRef.current;
    const normalized = cnr.replace(/[\s-]/g, '').toUpperCase();
    setCnr(normalized);
    setSearching(true);
    setUpdatingDetails(false);
    setShowDataReadyToast(false);
    setError(null);
    setResult(null);
    setHasSearched(true);

    if (!CNR_PATTERN.test(normalized)) {
      setSearching(false);
      setError(
        `CNR should be exactly 16 letters/digits (you entered ${normalized.length}). Remove spaces or hyphens and try again.`,
      );
      return;
    }

    try {
      const caseDetail = await fetchCaseByCnr(normalized);
      if (generation !== refreshGenerationRef.current) return;

      setResult(caseDetail);
      setSearching(false);

      try {
        await refreshCaseByCnr(normalized);
      } catch {
        // Soft failure — still re-fetch after wait.
      }
      if (generation !== refreshGenerationRef.current) return;

      setUpdatingDetails(true);
      await waitMs(8000);
      if (generation !== refreshGenerationRef.current) return;

      try {
        const refreshed = await fetchCaseByCnr(normalized);
        if (generation !== refreshGenerationRef.current) return;
        setResult(refreshed);
      } catch {
        // Keep the previously shown detail on re-fetch failure.
      }

      if (generation !== refreshGenerationRef.current) return;
      setUpdatingDetails(false);
      setShowDataReadyToast(true);
      window.setTimeout(() => {
        if (generation === refreshGenerationRef.current) {
          setShowDataReadyToast(false);
        }
      }, 1000);
    } catch (err) {
      if (generation !== refreshGenerationRef.current) return;
      setResult(null);
      setError(getErrorMessage(err));
      setSearching(false);
      setUpdatingDetails(false);
    }
  }

  return (
    <div className="space-y-3">
      <AutoDismissToast message="All data are available" visible={showDataReadyToast} />
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3"
      >
        <h2 className="shrink-0 font-display text-lg text-navy sm:text-xl">CNR Search</h2>

        <label htmlFor={`${formId}-cnr`} className="sr-only">
          CNR Number
        </label>
        <input
          id={`${formId}-cnr`}
          type="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          className={`${fieldClass} font-mono uppercase sm:max-w-xs lg:max-w-sm`}
          value={cnr}
          onChange={(e) => setCnr(e.target.value.toUpperCase())}
          placeholder="CNR Number (16 chars)"
        />

        <span className="shrink-0 text-xs text-inkSoft sm:whitespace-nowrap">
          {normalizedPreview.length || 0}/16
        </span>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-sm bg-navy px-4 text-sm font-semibold text-parchment transition hover:bg-navyDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>

        {searching ? <Spinner label="Looking up…" /> : null}
        {!searching && updatingDetails ? <Spinner label="Updating full details…" /> : null}
      </form>

      {error ? (
        <p className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy" role="alert">
          {error}
        </p>
      ) : null}

      {hasSearched && !searching && !error && !result ? (
        <p className="rounded-sm border border-navy/10 bg-parchment px-3 py-3 text-sm text-inkSoft">
          No case found for this CNR.
        </p>
      ) : null}

      {result ? <CaseDetailView caseData={result} searchMode="cnr" /> : null}
    </div>
  );
}
