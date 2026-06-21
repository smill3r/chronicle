import { create } from 'zustand';
import type { HistoricalEvent } from '../types';

interface Filters {
  /** Raw value bound to the search input. */
  searchInput: string;
  /** Debounced value sent to the API. */
  searchQuery: string;
  /** Active category filter, or null for no filter. */
  category: string | null;
  /** Active year range [start, end], or null for no range filter. */
  yearRange: [number, number] | null;
}

interface TimelinePageState {
  selectedEvent: HistoricalEvent | null;
  filters: Filters;

  setSelectedEvent: (event: HistoricalEvent | null) => void;
  /** Toggle: selecting the same event again deselects it. */
  toggleEvent: (event: HistoricalEvent) => void;

  setSearchInput: (value: string) => void;
  commitSearch: (value: string) => void;
  setCategory: (cat: string | null) => void;
  setYearRange: (range: [number, number] | null) => void;
  clearFilters: () => void;

  /** Call when navigating to a new timeline slug to wipe stale state. */
  reset: () => void;
}

const DEFAULT_FILTERS: Filters = {
  searchInput: '',
  searchQuery: '',
  category: null,
  yearRange: null,
};

export const useTimelinePageStore = create<TimelinePageState>((set) => ({
  selectedEvent: null,
  filters: { ...DEFAULT_FILTERS },

  setSelectedEvent: (event) => set({ selectedEvent: event }),

  toggleEvent: (event) =>
    set((s) => ({
      selectedEvent: s.selectedEvent?._id === event._id ? null : event,
    })),

  setSearchInput: (value) =>
    set((s) => ({ filters: { ...s.filters, searchInput: value } })),

  commitSearch: (value) =>
    set((s) => ({ filters: { ...s.filters, searchQuery: value } })),

  setCategory: (cat) =>
    set((s) => ({ filters: { ...s.filters, category: cat } })),

  setYearRange: (range) =>
    set((s) => ({ filters: { ...s.filters, yearRange: range } })),

  clearFilters: () =>
    set({ filters: { ...DEFAULT_FILTERS } }),

  reset: () => set({ selectedEvent: null, filters: { ...DEFAULT_FILTERS } }),
}));

/** True if any filter is currently active. */
export function useHasActiveFilters(): boolean {
  const { filters } = useTimelinePageStore();
  return (
    filters.category !== null ||
    filters.yearRange !== null ||
    filters.searchQuery !== ''
  );
}
