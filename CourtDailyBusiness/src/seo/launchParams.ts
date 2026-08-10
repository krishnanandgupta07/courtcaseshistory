import type { CourtTypeId, SearchModeId } from '../types/ecourts';
import { isSearchMode } from '../config/courtLevels';

const COURT_TYPE_ALIASES: Record<string, CourtTypeId> = {
  supreme: 'supreme',
  sc: 'supreme',
  high: 'high',
  hc: 'high',
  district: 'district',
  dc: 'district',
  tribunal: 'tribunal',
  tribunals: 'tribunal',
};

export type SearchLaunchParams = {
  courtTypeId: CourtTypeId | null;
  searchModeId: SearchModeId | null;
  preferredCourtName: string | null;
  initialCnr: string | null;
};

export function readSearchLaunchParams(
  search = typeof window !== 'undefined' ? window.location.search : '',
): SearchLaunchParams {
  const params = new URLSearchParams(search);
  const rawCourtType = (params.get('courtType') || params.get('court') || '').trim().toLowerCase();
  const rawMode = (params.get('mode') || '').trim().toLowerCase();
  const preferredCourtName = (params.get('courtName') || '').trim() || null;
  const initialCnr = (params.get('q') || params.get('cnr') || '').replace(/[\s-]/g, '').toUpperCase() || null;

  const courtTypeId = COURT_TYPE_ALIASES[rawCourtType] ?? null;
  const searchModeId = isSearchMode(rawMode)
    ? rawMode
    : rawMode === 'case-status-search'
      ? 'case-status'
      : initialCnr
        ? 'cnr'
        : null;

  return {
    courtTypeId,
    searchModeId,
    preferredCourtName,
    initialCnr,
  };
}
