import { create } from 'zustand';
import { api } from '../api/client';
import type { Timeline } from '../types';

type SortKey = 'events' | 'era' | 'title';
type Status = 'idle' | 'loading' | 'success' | 'error';

interface TimelinesState {
  timelines: Timeline[];
  status: Status;
  error: string | null;
  sortBy: SortKey;

  /** Fetch the timeline list from the API. Safe to call multiple times — the
   *  API client's module-level cache prevents redundant network requests. */
  fetch: () => Promise<void>;

  setSortBy: (key: SortKey) => void;
}

function sort(timelines: Timeline[], by: SortKey): Timeline[] {
  return [...timelines].sort((a, b) => {
    switch (by) {
      case 'events': return b.eventCount - a.eventCount;
      case 'era':    return (a.yearStart ?? 0) - (b.yearStart ?? 0);
      case 'title':  return a.title.localeCompare(b.title);
    }
  });
}

export const useTimelinesStore = create<TimelinesState>((set) => ({
  timelines: [],
  status: 'idle',
  error: null,
  sortBy: 'events',

  fetch: async () => {
    set({ status: 'loading', error: null });
    try {
      const data = await api.timelines.list();
      set({ timelines: data, status: 'success' });
    } catch (e) {
      set({ status: 'error', error: (e as Error).message });
    }
  },

  setSortBy: (key) => set({ sortBy: key }),
}));

/** Returns the current timeline list sorted by the active sort key. */
export function useSortedTimelines(): Timeline[] {
  const { timelines, sortBy } = useTimelinesStore();
  return sort(timelines, sortBy);
}
