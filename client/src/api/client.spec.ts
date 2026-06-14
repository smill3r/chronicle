import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './client';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function mockOk(body: unknown) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => mockFetch.mockReset());

describe('api.timelines.list', () => {
  it('calls GET /api/timelines', async () => {
    mockOk([]);
    await api.timelines.list();
    expect(mockFetch).toHaveBeenCalledWith('/api/timelines');
  });
});

describe('api.timelines.get', () => {
  it('calls GET /api/timelines/:slug', async () => {
    mockOk({});
    await api.timelines.get('ancient-history');
    expect(mockFetch).toHaveBeenCalledWith('/api/timelines/ancient-history');
  });
});

describe('api.timelines.events', () => {
  it('calls events endpoint with no params', async () => {
    mockOk({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
    await api.timelines.events('ancient-history');
    expect(mockFetch).toHaveBeenCalledWith('/api/timelines/ancient-history/events');
  });

  it('appends yearStart and yearEnd', async () => {
    mockOk({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
    await api.timelines.events('ancient-history', { yearStart: -1000, yearEnd: 0 });
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain('yearStart=-1000');
    expect(url).toContain('yearEnd=0');
  });

  it('appends category filter', async () => {
    mockOk({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
    await api.timelines.events('ancient-history', { category: 'War,Politics' });
    expect(mockFetch.mock.calls[0][0]).toContain('category=War%2CPolitics');
  });

  it('appends q search param', async () => {
    mockOk({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 });
    await api.timelines.events('ancient-history', { q: 'Caesar' });
    expect(mockFetch.mock.calls[0][0]).toContain('q=Caesar');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('Not found') });
    await expect(api.timelines.events('bad-slug')).rejects.toThrow('API 404');
  });
});
