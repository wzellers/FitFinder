import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import RatingPrompt from '@/components/RatingPrompt';
import { makeTop, makeBottom, makeShoes } from '../factories/clothingItem';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

// Use vi.hoisted to ensure mockInFn is available when vi.mock factory is called
const mockInFn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: mockInFn,
      })),
    })),
  },
}));

const top = makeTop({ id: 'top-1' });
const bottom = makeBottom({ id: 'bot-1' });
const shoes = makeShoes({ id: 'shoes-1' });

const pendingRating = {
  wear_id: 'wear-1',
  worn_date: '2026-02-26',
  outfit_items: {
    top_id: 'top-1',
    bottom_id: 'bot-1',
    shoes_id: 'shoes-1',
  },
};

beforeEach(() => {
  mockInFn.mockResolvedValue({ data: [top, bottom, shoes], error: null });
});

describe('RatingPrompt', () => {
  it('renders the header text immediately', () => {
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    // Header renders synchronously before async item loading
    expect(screen.getByText("Rate Yesterday's Outfit")).toBeTruthy();
  });

  it('renders the date', () => {
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    expect(screen.getByText(/February 26/)).toBeTruthy();
  });

  it('shows Skip and Submit Rating buttons', () => {
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    expect(screen.getByText('Skip')).toBeTruthy();
    expect(screen.getByText('Submit Rating')).toBeTruthy();
  });

  it('calls onSkip when Skip is clicked', () => {
    const onSkip = vi.fn();
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={onSkip}
        onMinimize={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it('calls onMinimize when minimize button clicked', () => {
    const onMinimize = vi.fn();
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={onMinimize}
      />,
    );
    const minBtn = document.querySelector('.btn-ghost');
    if (minBtn) fireEvent.click(minBtn);
    expect(onMinimize).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit with wear_id and rating when Submit is clicked', () => {
    const onSubmit = vi.fn();
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={onSubmit}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Submit Rating'));
    expect(onSubmit).toHaveBeenCalledWith('wear-1', 5, undefined);
  });

  it('shows comfort rating section when checkbox is toggled', () => {
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    expect(screen.getByText('Super comfy')).toBeTruthy();
  });

  it('includes comfort rating in submit when enabled', () => {
    const onSubmit = vi.fn();
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={onSubmit}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByText('Submit Rating'));
    expect(onSubmit).toHaveBeenCalledWith('wear-1', 5, 5);
  });

  it('loads items from supabase', async () => {
    render(
      <RatingPrompt
        pendingRating={pendingRating}
        onSubmit={vi.fn()}
        onSkip={vi.fn()}
        onMinimize={vi.fn()}
      />,
    );
    await waitFor(() => expect(mockInFn).toHaveBeenCalledTimes(1));
  });
});
