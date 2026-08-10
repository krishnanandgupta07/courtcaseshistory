import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { SelectOption } from '../types/ecourts';

const PAGE_SIZE = 20;

const fieldClass =
  'w-full min-w-0 rounded-sm border border-navy/15 bg-parchment px-2.5 py-1.5 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 disabled:cursor-not-allowed disabled:opacity-60';

const labelClass = 'mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-inkSoft';

type Props = {
  id?: string;
  label?: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
  onChange: (value: string) => void;
  onActivate?: () => void;
};

function splitWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * Starts-with search:
 * - "w" → name/code or any word starting with "w"
 * - "writ pet" → each word token must match the start of some name/code word
 * Mid-word substring matches (e.g. "vie" in "Review") are excluded.
 */
function rankCaseTypeMatch(option: SelectOption, query: string): number | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return 0;

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const name = option.name.toLowerCase();
  const code = option.code.toLowerCase();
  const nameWords = splitWords(option.name);
  const codeWords = splitWords(option.code);
  let score = 0;

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    let best = 0;

    if (name.startsWith(token)) best = Math.max(best, 100 - index);
    if (code.startsWith(token)) best = Math.max(best, 90 - index);

    for (const word of nameWords) {
      if (word.startsWith(token)) {
        const wordBonus = word === nameWords[0] ? 20 : 0;
        best = Math.max(best, 70 + wordBonus - index);
      }
    }
    for (const word of codeWords) {
      if (word.startsWith(token)) {
        best = Math.max(best, 55 - index);
      }
    }

    if (best === 0) return null;
    score += best;
  }

  return score;
}

export function CaseTypeSelect({
  id,
  label = 'Case Type',
  value,
  options,
  disabled = false,
  placeholder = 'Select case type',
  loading = false,
  onChange,
  onActivate,
}: Props) {
  const autoId = useId();
  const fieldId = id || autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const selected = options.find((option) => option.code === value) ?? null;

  const filtered = useMemo(() => {
    const ranked = options
      .map((option) => {
        const score = rankCaseTypeMatch(option, query);
        return score == null ? null : { option, score };
      })
      .filter((entry): entry is { option: SelectOption; score: number } => entry != null)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.option.name.localeCompare(b.option.name, undefined, {
          sensitivity: 'base',
          numeric: true,
        });
      });

    return ranked.map((entry) => entry.option);
  }, [options, query]);

  const visible = filtered.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, options]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function onListScroll() {
    const list = listRef.current;
    if (!list) return;
    const nearBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 24;
    if (nearBottom && visibleCount < filtered.length) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, filtered.length));
    }
  }

  function activateAndOpen() {
    if (disabled) return;
    onActivate?.();
    setOpen(true);
  }

  return (
    <div ref={rootRef} className="relative">
      <label htmlFor={fieldId} className={labelClass}>
        {label}
      </label>
      <button
        id={fieldId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={activateAndOpen}
        className={`${fieldClass} flex items-center justify-between gap-2 text-left ${
          disabled ? '' : 'cursor-pointer'
        }`}
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-inkSoft'}`}>
          {loading && !selected
            ? 'Loading…'
            : selected
              ? `${selected.name} (${selected.code})`
              : placeholder}
        </span>
        <span className="shrink-0 text-inkSoft" aria-hidden>
          ▾
        </span>
      </button>

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 w-full min-w-[16rem] overflow-hidden rounded-sm border border-navy/15 bg-parchment shadow-slip">
          <div className="border-b border-navy/10 p-2">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search case type…"
              className="w-full rounded-sm border border-navy/15 bg-white px-2 py-1.5 text-sm text-ink focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40"
              aria-label="Search case types"
            />
          </div>

          <ul
            ref={listRef}
            role="listbox"
            aria-label="Case types"
            className="max-h-56 overflow-auto py-1"
            onScroll={onListScroll}
          >
            {loading && options.length === 0 ? (
              <li className="px-3 py-2 text-sm text-inkSoft">Loading…</li>
            ) : visible.length === 0 ? (
              <li className="px-3 py-2 text-sm text-inkSoft">
                {options.length === 0 ? 'Select case type' : 'No case types match your search.'}
              </li>
            ) : (
              visible.map((option) => {
                const active = option.code === value;
                return (
                  <li key={option.code}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`flex w-full px-3 py-1.5 text-left text-sm transition hover:bg-brass/15 ${
                        active ? 'bg-brass/20 font-semibold text-navy' : 'text-ink'
                      }`}
                      onClick={() => {
                        onChange(option.code);
                        setOpen(false);
                        setQuery('');
                      }}
                    >
                      <span className="truncate">{option.name}</span>
                      <span className="ml-auto shrink-0 pl-2 text-xs text-inkSoft">
                        {option.code}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
