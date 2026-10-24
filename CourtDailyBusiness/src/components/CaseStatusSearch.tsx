import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  cnrsNeedingExplicitRefresh,
  enrichSearchResultsWithCaseDetails,
  fetchAppCourtsList,
  fetchCaseTypesByBench,
  fetchCourts,
  fetchReferenceCaseTypes,
  fetchReferenceCourtComplexes,
  fetchReferenceCourts,
  fetchReferenceDistricts,
  fetchReferenceStates,
  fetchReferenceTribunalCaseTypes,
  fetchReferenceTribunalCourts,
  fetchReferenceTribunals,
  getErrorMessage,
  refreshCaseByCnr,
  reloadCasesAfterRefresh,
  resolveEcourtsCourtCode,
  searchByCaseNumber,
  type AppCourtGroup,
} from '../api/ecourts';
import { buildYearOptions, toCourtLevel } from '../config/courtLevels';
import type { CaseDetail, SelectOption } from '../types/ecourts';
import { AutoDismissToast } from './AutoDismissToast';
import { CaseDetailView } from './CaseDetailView';
import { CaseTypeSelect } from './CaseTypeSelect';

type Props = {
  courtTypeId: string;
  preferredCourtName?: string | null;
};

const years = buildYearOptions(1950);

const fieldClass =
  'w-full min-w-0 rounded-sm border border-navy/15 bg-parchment px-2.5 py-1.5 text-sm text-ink shadow-sm focus:border-brass focus:outline-none focus:ring-2 focus:ring-brass/40 disabled:cursor-not-allowed disabled:opacity-60';

const labelClass = 'mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-inkSoft';

function Spinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-inkSoft" role="status">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-brass/30 border-t-brass"
        aria-hidden
      />
      {label}
    </span>
  );
}

function SelectField(props: {
  id: string;
  label: string;
  value: string;
  options: SelectOption[];
  disabled?: boolean;
  placeholder: string;
  hideEmptyOption?: boolean;
  onChange: (value: string) => void;
  onActivate?: () => void;
}) {
  return (
    <div>
      <label htmlFor={props.id} className={labelClass}>
        {props.label}
      </label>
      <select
        id={props.id}
        className={fieldClass}
        value={props.value}
        disabled={props.disabled || (props.options.length === 0 && !props.onActivate)}
        onFocus={() => props.onActivate?.()}
        onMouseDown={() => props.onActivate?.()}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {!props.hideEmptyOption ? <option value="">{props.placeholder}</option> : null}
        {props.options.map((item) => (
          <option key={item.code} value={item.code}>
            {item.name}
          </option>
        ))}
      </select>
    </div>
  );
}

const DEFAULT_HIGH_COURT_MATCH = /telangana/i;

function normalizeCourtLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function pickDefaultCourtName(
  groups: AppCourtGroup[],
  courtLevel: string,
  preferredCourtName?: string | null,
): string {
  if (groups.length === 0) return '';
  if (courtLevel === 'SC') return groups[0].courtName;

  if (preferredCourtName) {
    const preferred = normalizeCourtLabel(preferredCourtName);
    const exact = groups.find(
      (group) => normalizeCourtLabel(group.courtName) === preferred,
    );
    if (exact) return exact.courtName;
    const partial = groups.find((group) => {
      const name = normalizeCourtLabel(group.courtName);
      return name.includes(preferred) || preferred.includes(name);
    });
    if (partial) return partial.courtName;
  }

  const telangana = groups.find((group) => DEFAULT_HIGH_COURT_MATCH.test(group.courtName));
  return telangana?.courtName ?? groups[0].courtName;
}

function firstBenchIdForCourt(groups: AppCourtGroup[], courtName: string): string {
  return groups.find((group) => group.courtName === courtName)?.benches[0]?.code ?? '';
}

export function CaseStatusSearch({ courtTypeId, preferredCourtName }: Props) {
  const formId = useId();
  const courtLevel = toCourtLevel(courtTypeId);
  const isDistrict = courtTypeId === 'district';
  const isTribunal = courtTypeId === 'tribunal';
  const isSupreme = courtTypeId === 'supreme';
  const isHigh = courtTypeId === 'high';
  const isSimpleCourtLevel = isSupreme || isHigh;

  // Shared identifiers
  const [caseTypes, setCaseTypes] = useState<SelectOption[]>([]);
  const [caseTypeCode, setCaseTypeCode] = useState('');
  const [year, setYear] = useState(String(years[0]));
  const [caseNumber, setCaseNumber] = useState('');
  const [courtCode, setCourtCode] = useState('');

  // SC / HC — local courts/benches + eCourts codes for search
  const [courtGroups, setCourtGroups] = useState<AppCourtGroup[]>([]);
  const [courtName, setCourtName] = useState('');
  const [benchId, setBenchId] = useState('');
  const [ecourtsCourts, setEcourtsCourts] = useState<SelectOption[]>([]);
  const [courtsLoading, setCourtsLoading] = useState(false);
  const [courtsError, setCourtsError] = useState<string | null>(null);
  const [courtsReloadKey, setCourtsReloadKey] = useState(0);

  const courtOptions: SelectOption[] = courtGroups.map((group) => ({
    code: group.courtName,
    name: group.courtName,
  }));
  const benchOptions =
    courtGroups.find((group) => group.courtName === courtName)?.benches ?? [];
  const selectedBenchName =
    benchOptions.find((bench) => bench.code === benchId)?.name ?? '';

  // District cascade
  const [states, setStates] = useState<SelectOption[]>([]);
  const [districts, setDistricts] = useState<SelectOption[]>([]);
  const [complexes, setComplexes] = useState<SelectOption[]>([]);
  const [dcCourts, setDcCourts] = useState<SelectOption[]>([]);
  const [stateId, setStateId] = useState('');
  const [districtId, setDistrictId] = useState('');
  const [complexId, setComplexId] = useState('');
  const [statesLoading, setStatesLoading] = useState(false);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [complexesLoading, setComplexesLoading] = useState(false);
  const [dcCourtsLoading, setDcCourtsLoading] = useState(false);
  const [statesError, setStatesError] = useState<string | null>(null);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [complexesError, setComplexesError] = useState<string | null>(null);
  const [dcCourtsError, setDcCourtsError] = useState<string | null>(null);
  const [statesReloadKey, setStatesReloadKey] = useState(0);

  // Tribunal cascade
  const [tribunals, setTribunals] = useState<SelectOption[]>([]);
  const [tribunalCourts, setTribunalCourts] = useState<SelectOption[]>([]);
  const [tribunalCode, setTribunalCode] = useState('');
  const [tribunalsLoading, setTribunalsLoading] = useState(false);
  const [tribunalCourtsLoading, setTribunalCourtsLoading] = useState(false);
  const [tribunalsError, setTribunalsError] = useState<string | null>(null);
  const [tribunalCourtsError, setTribunalCourtsError] = useState<string | null>(null);
  const [tribunalsReloadKey, setTribunalsReloadKey] = useState(0);

  const [caseTypesLoading, setCaseTypesLoading] = useState(false);
  const [caseTypesError, setCaseTypesError] = useState<string | null>(null);
  const [caseTypesReloadKey, setCaseTypesReloadKey] = useState(0);
  /** SC/HC: wait until user opens Case Type (avoids heavy fetch on tab open). */
  const [caseTypesEnabled, setCaseTypesEnabled] = useState(false);
  const [searching, setSearching] = useState(false);
  const [updatingDetails, setUpdatingDetails] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [results, setResults] = useState<CaseDetail[] | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showDataReadyToast, setShowDataReadyToast] = useState(false);
  const refreshGenerationRef = useRef(0);

  const selectedComplexName =
    complexes.find((item) => item.code === complexId)?.name ?? '';
  const selectedDistrictCourtName =
    dcCourts.find((item) => item.code === courtCode)?.name ?? '';
  const selectedTribunalName =
    tribunals.find((item) => item.code === tribunalCode)?.name ?? '';
  const selectedTribunalCourtName =
    tribunalCourts.find((item) => item.code === courtCode)?.name ?? '';
  const searchBenchName = isSimpleCourtLevel
    ? selectedBenchName
    : isDistrict
      ? selectedDistrictCourtName
      : selectedTribunalCourtName;
  const searchCourtName = isSimpleCourtLevel
    ? courtName
    : isDistrict
      ? selectedDistrictCourtName || selectedComplexName
      : selectedTribunalCourtName || selectedTribunalName;

  function resetResults() {
    refreshGenerationRef.current += 1;
    setResults(null);
    setHasSearched(false);
    setSearchError(null);
    setUpdatingDetails(false);
    setShowDataReadyToast(false);
  }

  // Reset when court type tab changes
  useEffect(() => {
    setCourtCode('');
    setCourtName('');
    setBenchId('');
    setCourtGroups([]);
    setEcourtsCourts([]);
    setCaseTypeCode('');
    setCaseTypes([]);
    setCaseTypesError(null);
    setCaseTypesEnabled(false);
    setCaseNumber('');
    setYear(String(years[0]));
    setStateId('');
    setDistrictId('');
    setComplexId('');
    setDistricts([]);
    setComplexes([]);
    setDcCourts([]);
    setTribunalCode('');
    setTribunalCourts([]);
    resetResults();
  }, [courtTypeId]);

  // Case types: load only after user opens the Case Type dropdown
  const caseTypesParentKey = isDistrict
    ? districtId
    : isTribunal
      ? courtCode
      : benchId;
  const caseTypesReady = Boolean(caseTypesParentKey);
  const caseTypesSourceKey =
    caseTypesEnabled && caseTypesParentKey ? caseTypesParentKey : '';

  useEffect(() => {
    setCaseTypesEnabled(false);
    setCaseTypeCode('');
    setCaseTypes([]);
    setCaseTypesError(null);
  }, [caseTypesParentKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadCaseTypes() {
      setCaseTypeCode('');
      setCaseTypes([]);
      setCaseTypesError(null);

      if (!caseTypesSourceKey) {
        setCaseTypesLoading(false);
        return;
      }

      setCaseTypesLoading(true);
      try {
        let items: SelectOption[];
        if (isDistrict) {
          items = await fetchReferenceCaseTypes(caseTypesSourceKey);
        } else if (isTribunal) {
          items = await fetchReferenceTribunalCaseTypes(caseTypesSourceKey);
        } else {
          items = await fetchCaseTypesByBench(caseTypesSourceKey);
        }
        if (!cancelled) setCaseTypes(items);
      } catch (error: unknown) {
        if (!cancelled) setCaseTypesError(getErrorMessage(error));
      } finally {
        if (!cancelled) setCaseTypesLoading(false);
      }
    }

    void loadCaseTypes();

    return () => {
      cancelled = true;
    };
  }, [isDistrict, isTribunal, caseTypesSourceKey, caseTypesReloadKey]);

  // SC / HC: local court/bench list + eCourts codes for search
  useEffect(() => {
    if (!isSimpleCourtLevel) return;

    let cancelled = false;
    setCourtGroups([]);
    setCourtName('');
    setBenchId('');
    setEcourtsCourts([]);
    setCaseTypesEnabled(false);
    setCourtsError(null);
    setCourtsLoading(true);
    resetResults();

    // Lightweight courts first so the form unlocks quickly; eCourts codes can follow.
    fetchAppCourtsList(courtLevel)
      .then((groups) => {
        if (cancelled) return;
        setCourtGroups(groups);
        const defaultCourt = pickDefaultCourtName(groups, courtLevel, preferredCourtName);
        setCourtName(defaultCourt);
        setBenchId(firstBenchIdForCourt(groups, defaultCourt));
      })
      .catch((error: unknown) => {
        if (!cancelled) setCourtsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setCourtsLoading(false);
      });

    fetchCourts(courtLevel)
      .then((ecourts) => {
        if (!cancelled) setEcourtsCourts(ecourts);
      })
      .catch(() => {
        if (!cancelled) setEcourtsCourts([]);
      });

    return () => {
      cancelled = true;
    };
  }, [isSimpleCourtLevel, courtLevel, courtsReloadKey, preferredCourtName]);

  // District: states
  useEffect(() => {
    if (!isDistrict) return;

    let cancelled = false;
    setStates([]);
    setStateId('');
    setDistricts([]);
    setDistrictId('');
    setComplexes([]);
    setComplexId('');
    setDcCourts([]);
    setCourtCode('');
    setStatesError(null);
    setStatesLoading(true);
    resetResults();

    fetchReferenceStates()
      .then((items) => {
        if (!cancelled) setStates(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setStatesError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setStatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDistrict, statesReloadKey]);

  // District: districts by state
  useEffect(() => {
    if (!isDistrict || !stateId) {
      setDistricts([]);
      setDistrictId('');
      return;
    }

    let cancelled = false;
    setDistricts([]);
    setDistrictId('');
    setComplexes([]);
    setComplexId('');
    setDcCourts([]);
    setCourtCode('');
    setDistrictsError(null);
    setDistrictsLoading(true);
    resetResults();

    fetchReferenceDistricts(stateId)
      .then((items) => {
        if (!cancelled) setDistricts(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDistrictsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDistrict, stateId]);

  // District: complexes by district
  useEffect(() => {
    if (!isDistrict || !districtId) {
      setComplexes([]);
      setComplexId('');
      return;
    }

    let cancelled = false;
    setComplexes([]);
    setComplexId('');
    setDcCourts([]);
    setCourtCode('');
    setComplexesError(null);
    setComplexesLoading(true);
    resetResults();

    fetchReferenceCourtComplexes(districtId)
      .then((items) => {
        if (!cancelled) setComplexes(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setComplexesError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setComplexesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDistrict, districtId]);

  // District: courts by complex
  useEffect(() => {
    if (!isDistrict || !complexId) {
      setDcCourts([]);
      setCourtCode('');
      return;
    }

    let cancelled = false;
    setDcCourts([]);
    setCourtCode('');
    setDcCourtsError(null);
    setDcCourtsLoading(true);
    resetResults();

    fetchReferenceCourts(complexId)
      .then((items) => {
        if (!cancelled) setDcCourts(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setDcCourtsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setDcCourtsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isDistrict, complexId]);

  // Tribunal: list
  useEffect(() => {
    if (!isTribunal) return;

    let cancelled = false;
    setTribunals([]);
    setTribunalCode('');
    setTribunalCourts([]);
    setCourtCode('');
    setTribunalsError(null);
    setTribunalsLoading(true);
    resetResults();

    fetchReferenceTribunals()
      .then((items) => {
        if (!cancelled) setTribunals(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setTribunalsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setTribunalsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTribunal, tribunalsReloadKey]);

  // Tribunal: courts by tribunal
  useEffect(() => {
    if (!isTribunal || !tribunalCode) {
      setTribunalCourts([]);
      setCourtCode('');
      return;
    }

    let cancelled = false;
    setTribunalCourts([]);
    setCourtCode('');
    setTribunalCourtsError(null);
    setTribunalCourtsLoading(true);
    resetResults();

    fetchReferenceTribunalCourts(tribunalCode)
      .then((items) => {
        if (!cancelled) setTribunalCourts(items);
      })
      .catch((error: unknown) => {
        if (!cancelled) setTribunalCourtsError(getErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setTribunalCourtsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTribunal, tribunalCode]);

  const cascadeLoading =
    statesLoading ||
    districtsLoading ||
    complexesLoading ||
    dcCourtsLoading ||
    tribunalsLoading ||
    tribunalCourtsLoading ||
    courtsLoading;

  const canSubmit =
    Boolean(
      (isSimpleCourtLevel ? courtName && benchId : courtCode) &&
        caseTypeCode &&
        year &&
        caseNumber.trim(),
    ) &&
    !searching &&
    !cascadeLoading;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;

    const generation = ++refreshGenerationRef.current;
    setSearching(true);
    setUpdatingDetails(false);
    setShowDataReadyToast(false);
    setSearchError(null);
    setHasSearched(true);
    setResults(null);

    try {
      let searchCourtCode = courtCode;
      if (isSimpleCourtLevel) {
        const resolved = resolveEcourtsCourtCode(
          ecourtsCourts,
          courtName,
          selectedBenchName,
        );
        if (!resolved) {
          throw new Error(
            'Could not map the selected court/bench to an eCourts court code. Please try another bench.',
          );
        }
        searchCourtCode = resolved;
      }

      const { results: items, refresh } = await searchByCaseNumber({
        courtCode: searchCourtCode,
        courtLevel,
        caseTypeCode,
        caseNumber: caseNumber.trim(),
        year,
      });
      if (generation !== refreshGenerationRef.current) return;

      const detailed = await enrichSearchResultsWithCaseDetails(items);
      if (generation !== refreshGenerationRef.current) return;

      setResults(detailed);
      setSearching(false);

      if (detailed.length === 0) return;

      const unmet = cnrsNeedingExplicitRefresh(detailed, refresh);
      await Promise.all(
        unmet.map(async (cnr) => {
          try {
            await refreshCaseByCnr(cnr);
          } catch {
            // Soft failure — still re-fetch after wait.
          }
        }),
      );
      if (generation !== refreshGenerationRef.current) return;

      setUpdatingDetails(true);
      const refreshed = await reloadCasesAfterRefresh(detailed, 8000);
      if (generation !== refreshGenerationRef.current) return;

      setResults(refreshed);
      setUpdatingDetails(false);
      setShowDataReadyToast(true);
      window.setTimeout(() => {
        if (generation === refreshGenerationRef.current) {
          setShowDataReadyToast(false);
        }
      }, 1000);
    } catch (error) {
      if (generation !== refreshGenerationRef.current) return;
      setResults(null);
      setSearchError(getErrorMessage(error));
      setSearching(false);
      setUpdatingDetails(false);
    }
  }

  const loadingLabel = searching
    ? 'Searching…'
    : updatingDetails
      ? 'Updating full details…'
      : caseTypesLoading
        ? 'Loading case types…'
        : statesLoading
          ? 'Loading states…'
          : districtsLoading
            ? 'Loading districts…'
            : complexesLoading
              ? 'Loading complexes…'
              : dcCourtsLoading
                ? 'Loading courts…'
                : tribunalsLoading
                  ? 'Loading tribunals…'
                  : tribunalCourtsLoading
                    ? 'Loading tribunal courts…'
                    : courtsLoading
                      ? 'Loading courts…'
                      : '';

  return (
    <div className="space-y-3">
      <AutoDismissToast message="All data are available" visible={showDataReadyToast} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg text-navy sm:text-xl">Case Status Search</h2>
        {loadingLabel ? <Spinner label={loadingLabel} /> : null}
      </div>

      {(caseTypesError ||
        courtsError ||
        statesError ||
        districtsError ||
        complexesError ||
        dcCourtsError ||
        tribunalsError ||
        tribunalCourtsError) && (
        <div className="space-y-2">
          {caseTypesError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              <span>Case types: {caseTypesError}</span>
              <button
                type="button"
                className="rounded-sm bg-burgundy px-2 py-1 text-xs font-semibold text-parchment"
                onClick={() => {
                  setCaseTypesEnabled(true);
                  setCaseTypesReloadKey((key) => key + 1);
                }}
              >
                Retry
              </button>
            </div>
          ) : null}
          {courtsError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              <span>Courts: {courtsError}</span>
              <button
                type="button"
                className="rounded-sm bg-burgundy px-2 py-1 text-xs font-semibold text-parchment"
                onClick={() => setCourtsReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}
          {statesError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              <span>States: {statesError}</span>
              <button
                type="button"
                className="rounded-sm bg-burgundy px-2 py-1 text-xs font-semibold text-parchment"
                onClick={() => setStatesReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}
          {districtsError ? (
            <div
              className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              Districts: {districtsError}
            </div>
          ) : null}
          {complexesError ? (
            <div
              className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              Court complexes: {complexesError}
            </div>
          ) : null}
          {dcCourtsError ? (
            <div
              className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              Courts: {dcCourtsError}
            </div>
          ) : null}
          {tribunalsError ? (
            <div
              className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              <span>Tribunals: {tribunalsError}</span>
              <button
                type="button"
                className="rounded-sm bg-burgundy px-2 py-1 text-xs font-semibold text-parchment"
                onClick={() => setTribunalsReloadKey((key) => key + 1)}
              >
                Retry
              </button>
            </div>
          ) : null}
          {tribunalCourtsError ? (
            <div
              className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy"
              role="alert"
            >
              Tribunal courts: {tribunalCourtsError}
            </div>
          ) : null}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className={`grid grid-cols-1 items-end gap-2 ${
          isDistrict
            ? 'sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_7rem_auto]'
            : isTribunal
              ? 'sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,1fr)_7rem_auto]'
              : isSupreme
                ? 'sm:grid-cols-2 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.7fr)_auto]'
                : 'sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_auto]'
        }`}
        aria-describedby={`${formId}-hint`}
      >
        {isSimpleCourtLevel ? (
          <>
            {isHigh ? (
              <>
                <SelectField
                  id={`${formId}-court`}
                  label="Court"
                  value={courtName}
                  options={courtOptions}
                  disabled={courtsLoading}
                  hideEmptyOption={Boolean(courtName)}
                  placeholder={
                    courtsLoading
                      ? 'Loading courts…'
                      : courtsError
                        ? 'Courts unavailable'
                        : 'Select court'
                  }
                  onChange={(value) => {
                    setCourtName(value);
                    setBenchId(firstBenchIdForCourt(courtGroups, value));
                    resetResults();
                  }}
                />
                <SelectField
                  id={`${formId}-bench`}
                  label="Bench"
                  value={benchId}
                  options={benchOptions}
                  disabled={!courtName || courtsLoading || benchOptions.length === 0}
                  hideEmptyOption={benchOptions.length > 0}
                  placeholder={
                    !courtName
                      ? 'Select court first'
                      : courtsLoading
                        ? 'Loading benches…'
                        : 'Bench'
                  }
                  onChange={(value) => {
                    setBenchId(value);
                    resetResults();
                  }}
                />
              </>
            ) : null}
            <div>
              <label htmlFor={`${formId}-case-number`} className={labelClass}>
                Case Number
              </label>
              <input
                id={`${formId}-case-number`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="Number"
              />
            </div>
            <CaseTypeSelect
              id={`${formId}-case-type`}
              value={caseTypeCode}
              options={caseTypes}
              disabled={!caseTypesReady}
              loading={caseTypesLoading}
              onActivate={() => {
                if (caseTypesReady) setCaseTypesEnabled(true);
              }}
              placeholder={
                !caseTypesReady
                  ? isSupreme
                    ? 'Loading…'
                    : 'Select bench first'
                  : 'Select case type'
              }
              onChange={setCaseTypeCode}
            />
            <div>
              <label htmlFor={`${formId}-year`} className={labelClass}>
                Year
              </label>
              <select
                id={`${formId}-year`}
                className={fieldClass}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        {isDistrict ? (
          <>
            <SelectField
              id={`${formId}-state`}
              label="State"
              value={stateId}
              options={states}
              disabled={statesLoading}
              placeholder={statesLoading ? 'Loading states…' : 'Select state'}
              onChange={setStateId}
            />
            <SelectField
              id={`${formId}-district`}
              label="District"
              value={districtId}
              options={districts}
              disabled={!stateId || districtsLoading}
              placeholder={
                !stateId
                  ? 'Select state first'
                  : districtsLoading
                    ? 'Loading districts…'
                    : 'Select district'
              }
              onChange={setDistrictId}
            />
            <SelectField
              id={`${formId}-complex`}
              label="Court Complex"
              value={complexId}
              options={complexes}
              disabled={!districtId || complexesLoading}
              placeholder={
                !districtId
                  ? 'Select district first'
                  : complexesLoading
                    ? 'Loading complexes…'
                    : 'Select complex'
              }
              onChange={setComplexId}
            />
            <SelectField
              id={`${formId}-dc-court`}
              label="Court"
              value={courtCode}
              options={dcCourts}
              disabled={!complexId || dcCourtsLoading}
              placeholder={
                !complexId
                  ? 'Select complex first'
                  : dcCourtsLoading
                    ? 'Loading courts…'
                    : 'Select court'
              }
              onChange={setCourtCode}
            />
          </>
        ) : null}

        {isTribunal ? (
          <>
            <SelectField
              id={`${formId}-tribunal`}
              label="Tribunal"
              value={tribunalCode}
              options={tribunals}
              disabled={tribunalsLoading}
              placeholder={tribunalsLoading ? 'Loading tribunals…' : 'Select tribunal'}
              onChange={setTribunalCode}
            />
            <SelectField
              id={`${formId}-tribunal-court`}
              label="Tribunal Court"
              value={courtCode}
              options={tribunalCourts}
              disabled={!tribunalCode || tribunalCourtsLoading}
              placeholder={
                !tribunalCode
                  ? 'Select tribunal first'
                  : tribunalCourtsLoading
                    ? 'Loading courts…'
                    : 'Select tribunal court'
              }
              onChange={setCourtCode}
            />
          </>
        ) : null}

        {!isSimpleCourtLevel ? (
          <>
            <div>
              <label htmlFor={`${formId}-case-number-other`} className={labelClass}>
                Case Number
              </label>
              <input
                id={`${formId}-case-number-other`}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className={fieldClass}
                value={caseNumber}
                onChange={(e) => setCaseNumber(e.target.value)}
                placeholder="Number"
              />
            </div>

            <CaseTypeSelect
              id={`${formId}-case-type-other`}
              value={caseTypeCode}
              options={caseTypes}
              disabled={
                (isDistrict && !districtId) || (isTribunal && !courtCode)
              }
              loading={caseTypesLoading}
              onActivate={() => {
                if (caseTypesReady) setCaseTypesEnabled(true);
              }}
              placeholder={
                isDistrict && !districtId
                  ? 'Select district first'
                  : isTribunal && !courtCode
                    ? 'Select tribunal court first'
                    : 'Select case type'
              }
              onChange={setCaseTypeCode}
            />

            <div>
              <label htmlFor={`${formId}-year`} className={labelClass}>
                Year
              </label>
              <select
                id={`${formId}-year`}
                className={fieldClass}
                value={year}
                onChange={(e) => setYear(e.target.value)}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <p id={`${formId}-hint`} className="sr-only">
          All fields are required before submitting the search.
        </p>

        <button
          type="submit"
          disabled={!canSubmit}
          className="inline-flex min-h-9 items-center justify-center rounded-sm bg-navy px-4 text-sm font-semibold text-parchment transition hover:bg-navyDeep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchError ? (
        <p className="rounded-sm border border-burgundy/30 bg-burgundy/5 px-3 py-2 text-sm text-burgundy" role="alert">
          {searchError}
        </p>
      ) : null}

      {hasSearched && !searching && !searchError && results && results.length === 0 ? (
        <p className="rounded-sm border border-navy/10 bg-parchment px-3 py-3 text-sm text-inkSoft">
          No cases found for the selected details.
        </p>
      ) : null}

      {results && results.length > 0 ? (
        <div className="space-y-4" aria-label="Search results">
          {results.length > 1 ? (
            <p className="text-sm text-inkSoft">
              Showing {results.length} matching cases with full details.
            </p>
          ) : null}
          {results.map((result, index) => (
            <CaseDetailView
              key={result.cnr || `${result.courtCode}-${result.registrationNumber}-${index}`}
              caseData={result}
              searchMode="case-status"
              courtLevel={courtLevel}
              searchBenchName={searchBenchName}
              searchCourtName={searchCourtName}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
