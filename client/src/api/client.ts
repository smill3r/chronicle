import type { Timeline, PaginatedEvents } from '../types';

export interface WikiSummary {
  summary: string | null;
  thumbnail: string | null;
  wikiLink: string;
}

const BASE = '/api';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface EventsParams {
  yearStart?: number;
  yearEnd?: number;
  category?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export const api = {
  timelines: {
    list: () => get<Timeline[]>('/timelines'),

    get: (slug: string) => get<Timeline>(`/timelines/${slug}`),

    events: (slug: string, params: EventsParams = {}) => {
      const qs = new URLSearchParams();
      if (params.yearStart !== undefined) qs.set('yearStart', String(params.yearStart));
      if (params.yearEnd !== undefined) qs.set('yearEnd', String(params.yearEnd));
      if (params.category) qs.set('category', params.category);
      if (params.q) qs.set('q', params.q);
      if (params.page) qs.set('page', String(params.page));
      if (params.limit) qs.set('limit', String(params.limit));
      const query = qs.toString();
      return get<PaginatedEvents>(`/timelines/${slug}/events${query ? `?${query}` : ''}`);
    },

    eventSummary: (slug: string, eventId: string) =>
      get<WikiSummary>(`/timelines/${slug}/events/${eventId}/summary`),
  },
};
