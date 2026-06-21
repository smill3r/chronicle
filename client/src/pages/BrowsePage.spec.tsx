import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BrowsePage from './BrowsePage';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: { timelines: { list: vi.fn() } },
}));

const mockTimelines = [
  {
    _id: '1', title: 'Timeline of ancient history', slug: 'ancient-history',
    eventCount: 120, yearStart: -4000, yearEnd: 0, categories: ['Politics', 'War'], sourceUrl: '',
  },
  {
    _id: '2', title: 'Timeline of the French Revolution', slug: 'the-french-revolution',
    eventCount: 106, yearStart: 1771, yearEnd: 1790, categories: ['Politics'], sourceUrl: '',
  },
];

beforeEach(() => { vi.clearAllMocks(); });

describe('BrowsePage', () => {
  it('renders timeline cards after loading', async () => {
    vi.mocked(api.timelines.list).mockResolvedValue(mockTimelines);
    render(<BrowsePage />, { wrapper: MemoryRouter });
    await waitFor(() => screen.getByText('Timeline of ancient history'));
    expect(screen.getByText('Timeline of the French Revolution')).toBeInTheDocument();
  });

  it('shows correct event counts', async () => {
    vi.mocked(api.timelines.list).mockResolvedValue(mockTimelines);
    render(<BrowsePage />, { wrapper: MemoryRouter });
    await waitFor(() => screen.getByText('120 events'));
    expect(screen.getByText('106 events')).toBeInTheDocument();
  });

  it('shows error message when API fails', async () => {
    vi.mocked(api.timelines.list).mockRejectedValue(new Error('Network error'));
    render(<BrowsePage />, { wrapper: MemoryRouter });
    await waitFor(() => screen.getByText(/Error: Network error/));
  });
});
