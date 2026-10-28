import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RatingPicker from '@/components/ui/RatingPicker';

const filled = () =>
  screen
    .getAllByRole('button')
    .filter((b) => b.dataset.filled === 'true')
    .map((b) => Number(b.textContent));

describe('RatingPicker', () => {
  it('fills the row up to the chosen rating', () => {
    render(<RatingPicker value={3} onChange={() => {}} legend="Rate" />);
    expect(filled()).toEqual([1, 2, 3]);
    expect(screen.getByRole('button', { name: '3 out of 10' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('previews a rating while pointing at it, and reports it', () => {
    const onPreview = vi.fn();
    render(<RatingPicker value={0} onChange={() => {}} legend="Rate" onPreview={onPreview} />);
    fireEvent.mouseEnter(screen.getByRole('button', { name: '7 out of 10' }));
    expect(filled()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(onPreview).toHaveBeenLastCalledWith(7);

    fireEvent.mouseLeave(screen.getByRole('button', { name: '7 out of 10' }).parentElement!);
    expect(filled()).toEqual([]);
    expect(onPreview).toHaveBeenLastCalledWith(0);
  });

  it('previews with the keyboard too', () => {
    const onPreview = vi.fn();
    render(<RatingPicker value={0} onChange={() => {}} legend="Rate" onPreview={onPreview} />);
    fireEvent.focus(screen.getByRole('button', { name: '4 out of 10' }));
    expect(filled()).toEqual([1, 2, 3, 4]);
    fireEvent.blur(screen.getByRole('button', { name: '4 out of 10' }));
    expect(onPreview).toHaveBeenLastCalledWith(0);
  });

  it('rates on click, and clears when clearable', () => {
    const onChange = vi.fn();
    render(<RatingPicker value={5} onChange={onChange} legend="Rate" />);
    fireEvent.click(screen.getByRole('button', { name: '8 out of 10' }));
    fireEvent.click(screen.getByRole('button', { name: '5 out of 10' }));
    expect(onChange.mock.calls).toEqual([[8], [0]]);
  });
});
