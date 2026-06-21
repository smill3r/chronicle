import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HighlightLegend from './HighlightLegend';

const CATS = ['War', 'Politics', 'Science'];

describe('HighlightLegend', () => {
  it('renders all category buttons', () => {
    render(<HighlightLegend categories={CATS} highlight={null} onToggle={() => {}} />);
    expect(screen.getByText('War')).toBeTruthy();
    expect(screen.getByText('Politics')).toBeTruthy();
    expect(screen.getByText('Science')).toBeTruthy();
  });

  it('calls onToggle with the category when a button is clicked', () => {
    const onToggle = vi.fn();
    render(<HighlightLegend categories={CATS} highlight={null} onToggle={onToggle} />);
    fireEvent.click(screen.getByText('War'));
    expect(onToggle).toHaveBeenCalledWith('War');
  });

  it('calls onToggle with null when the active category is clicked again', () => {
    const onToggle = vi.fn();
    render(<HighlightLegend categories={CATS} highlight="War" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('War'));
    expect(onToggle).toHaveBeenCalledWith(null);
  });

  it('marks the active category button with aria-pressed', () => {
    render(<HighlightLegend categories={CATS} highlight="Politics" onToggle={() => {}} />);
    const btn = screen.getByText('Politics').closest('button');
    expect(btn?.getAttribute('aria-pressed')).toBe('true');
  });
});
