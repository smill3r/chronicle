import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryFilter from './CategoryFilter';

const CATS = ['War', 'Politics', 'Science'];

describe('CategoryFilter', () => {
  it('renders a chip for each available category', () => {
    render(<CategoryFilter available={CATS} active={new Set(CATS)} onChange={() => {}} />);
    CATS.forEach((c) => expect(screen.getByText(c)).toBeInTheDocument());
  });

  it('calls onChange with category removed when active chip is clicked', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter available={CATS} active={new Set(CATS)} onChange={onChange} />);
    await userEvent.click(screen.getByText('War'));
    const next: Set<string> = onChange.mock.calls[0][0];
    expect(next.has('War')).toBe(false);
    expect(next.has('Politics')).toBe(true);
  });

  it('calls onChange with category added when inactive chip is clicked', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter available={CATS} active={new Set(['Politics'])} onChange={onChange} />);
    await userEvent.click(screen.getByText('War'));
    const next: Set<string> = onChange.mock.calls[0][0];
    expect(next.has('War')).toBe(true);
  });

  it('shows "None" toggle when all categories are active', () => {
    render(<CategoryFilter available={CATS} active={new Set(CATS)} onChange={() => {}} />);
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('shows "All" toggle when not all categories are active', () => {
    render(<CategoryFilter available={CATS} active={new Set(['War'])} onChange={() => {}} />);
    expect(screen.getByText('All')).toBeInTheDocument();
  });

  it('"None" click calls onChange with empty set', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter available={CATS} active={new Set(CATS)} onChange={onChange} />);
    await userEvent.click(screen.getByText('None'));
    expect(onChange.mock.calls[0][0].size).toBe(0);
  });

  it('"All" click calls onChange with all categories', async () => {
    const onChange = vi.fn();
    render(<CategoryFilter available={CATS} active={new Set()} onChange={onChange} />);
    await userEvent.click(screen.getByText('All'));
    const next: Set<string> = onChange.mock.calls[0][0];
    CATS.forEach((c) => expect(next.has(c)).toBe(true));
  });
});
