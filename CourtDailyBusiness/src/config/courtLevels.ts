import type { CourtLevel, CourtTypeId, SearchModeId } from '../types/ecourts';

export type NavItem = {
  id: string;
  label: string;
  mobileLabel: string;
};

export const courtTypes: NavItem[] = [
  { id: 'supreme', label: 'Supreme Court', mobileLabel: 'SC' },
  { id: 'high', label: 'High Court', mobileLabel: 'HC' },
  { id: 'district', label: 'District Court', mobileLabel: 'District' },
  { id: 'tribunal', label: 'Tribunals Courts', mobileLabel: 'Tribunal' },
];

export const searchModes: NavItem[] = [
  { id: 'cnr', label: 'CNR Search', mobileLabel: 'CNR' },
  { id: 'case-status', label: 'Case Status Search', mobileLabel: 'Case Status' },
];

/** First-load default: CNR works for every court and does not need a court tab. */
export const DEFAULT_SEARCH_MODE: SearchModeId = 'cnr';

const courtLevelByType: Record<CourtTypeId, CourtLevel> = {
  supreme: 'SC',
  high: 'HC',
  district: 'DC',
  tribunal: 'TRIBUNAL',
};

export function toCourtLevel(courtTypeId: string): CourtLevel {
  return courtLevelByType[courtTypeId as CourtTypeId] ?? 'SC';
}

export function isSearchMode(id: string): id is SearchModeId {
  return id === 'case-status' || id === 'cnr';
}

export function buildYearOptions(fromYear = 1950): number[] {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= fromYear; y -= 1) {
    years.push(y);
  }
  return years;
}
