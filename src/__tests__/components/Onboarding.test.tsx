import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';
import type { ClothingItem } from '@/lib/types';

const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn(() => ({ user: mockUser })) }));

// Every write, as [table, method, payload]; reads return the closet so far.
const db = vi.hoisted(() => ({
  writes: [] as [string, string, unknown][],
  closet: [] as unknown[],
  error: null as unknown,
}));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      upsert: vi.fn((payload: unknown) => {
        db.writes.push([table, 'upsert', payload]);
        return Promise.resolve({ error: db.error });
      }),
      update: vi.fn((payload: unknown) => {
        db.writes.push([table, 'update', payload]);
        return { eq: vi.fn(() => Promise.resolve({ error: db.error })) };
      }),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: db.closet, error: null })),
        })),
      })),
    })),
  },
}));

// The upload dialog, reduced to "a photo was added".
vi.mock('@/components/ImageUpload', () => ({
  default: ({
    isOpen,
    onItemsAdded,
  }: {
    isOpen: boolean;
    onItemsAdded?: (ids: string[]) => void;
  }) => (isOpen ? <button onClick={() => onItemsAdded?.(['x'])}>Finish upload</button> : null),
}));
vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

import Onboarding from '@/components/Onboarding';

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const writesTo = (table: string) => db.writes.filter(([t]) => t === table);

beforeEach(() => {
  db.writes = [];
  db.closet = [];
  db.error = null;
});

async function goToStep(n: number) {
  click(/Get started/);
  for (let i = 2; i < n; i++) {
    const current = screen.getByText(/^Step \d of 6/).textContent;
    click(/Continue|Skip for now|Not now/);
    await waitFor(() => expect(screen.getByText(/^Step \d of 6/).textContent).not.toBe(current));
  }
}

describe('Onboarding', () => {
  it('opens on a welcome that says what FitFinder does', () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Welcome to FitFinder' })).toBeInTheDocument();
    expect(screen.getByText('It learns your taste')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Setup steps' }).children).toHaveLength(6);
  });

  it('saves the ZIP code and moves the weather thresholds for someone who runs cold', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    click(/Get started/);
    fireEvent.change(screen.getByLabelText(/US ZIP code/), { target: { value: '9410a3' } });
    expect(screen.getByLabelText(/US ZIP code/)).toHaveValue('94103');
    click('I run cold');
    expect(screen.getByText('{ layers under 70° · shorts over 85° }')).toBeInTheDocument();
    click(/Continue/);
    await screen.findByRole('heading', { name: 'Build your closet' });
    expect(writesTo('profiles')).toEqual([['profiles', 'upsert', { id: 'u1', zip_code: '94103' }]]);
    expect(writesTo('weather_preferences')).toEqual([
      [
        'weather_preferences',
        'upsert',
        { user_id: 'u1', thresholds: { cold: 50, cool: 70, warm: 85 }, clothing_rules: null },
      ],
    ]);
  });

  it('saves nothing when the weather step is skipped', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    click(/Get started/);
    click(/Skip for now/);
    await screen.findByRole('heading', { name: 'Build your closet' });
    expect(db.writes).toEqual([]);
  });

  it('counts the closet as photos are added', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    await goToStep(3);
    const sections = screen.getByRole('list', { name: 'Closet so far' });
    expect(sections).toHaveTextContent('Tops0 / 3');
    expect(screen.getByRole('button', { name: /Skip for now/ })).toBeInTheDocument();

    db.closet = [makeTop(), makeTop(), makeTop(), makeBottom(), makeShoes()];
    click(/Add photos/);
    click('Finish upload');
    await waitFor(() => expect(sections).toHaveTextContent('Tops3 · nice'));
    expect(sections).toHaveTextContent('Bottoms1 / 3');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeInTheDocument();
  });

  it('saves the colour pairings picked', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    await goToStep(4);
    const pairing = screen.getByRole('button', { name: 'navy blue top with beige bottoms' });
    fireEvent.click(pairing);
    expect(pairing).toHaveAttribute('aria-pressed', 'true');
    click(/Continue/);
    await screen.findByRole('heading', { name: 'Your outfit, every morning' });
    expect(writesTo('color_preferences')).toEqual([
      [
        'color_preferences',
        'upsert',
        { user_id: 'u1', liked_combinations: [{ topColor: 'navy blue', bottomColor: 'beige' }] },
      ],
    ]);
  });

  it('leaves the daily email off unless it is turned on, then saves the time picked', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    await goToStep(5);
    const email = screen.getByRole('switch', { name: /Daily outfit email/ });
    expect(email).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(email);
    click('7:30 AM');
    click(/Continue/);
    await screen.findByText(/^Step 6 of 6/);
    const [[, method, payload]] = writesTo('profiles');
    expect(method).toBe('update');
    expect(payload).toMatchObject({ daily_email_enabled: true, daily_email_time: '07:30' });
    expect((payload as { timezone: string }).timezone).toBeTruthy();
  });

  it('warns but carries on when a step cannot save', async () => {
    db.error = { message: 'down' };
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    click(/Get started/);
    click('I run warm');
    click(/Continue/);
    await screen.findByRole('heading', { name: 'Build your closet' });
    expect(screen.getByText(/Couldn't save your weather settings/)).toBeInTheDocument();
  });

  it('finishes into the closet when there is not yet an outfit to make', async () => {
    const onComplete = vi.fn();
    renderWithProviders(<Onboarding onComplete={onComplete} />);
    await goToStep(6);
    expect(screen.getByRole('heading', { name: "You're all set" })).toBeInTheDocument();
    click('Go to my closet');
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(null));
    expect(writesTo('profiles')).toEqual([
      ['profiles', 'upsert', { id: 'u1', onboarding_completed: true }],
    ]);
  });

  it('spins a first outfit from the closet and opens it in Outfits', async () => {
    const closet: ClothingItem[] = [makeTop(), makeBottom(), makeShoes()];
    db.closet = closet;
    const onComplete = vi.fn();
    renderWithProviders(<Onboarding onComplete={onComplete} />);
    await goToStep(3);
    click(/Add photos/);
    click('Finish upload');
    await screen.findByRole('button', { name: /Continue/ });
    for (let i = 3; i < 6; i++) {
      const current = screen.getByText(/^Step \d of 6/).textContent;
      click(/Continue|Skip for now|Not now/);
      await waitFor(() => expect(screen.getByText(/^Step \d of 6/).textContent).not.toBe(current));
    }
    click(/Spin my first outfit/);
    expect(screen.getByRole('heading', { name: 'Your first fit' })).toBeInTheDocument();
    click(/See it in Outfits/);
    await waitFor(() =>
      expect(onComplete).toHaveBeenCalledWith({
        top_id: closet[0].id,
        bottom_id: closet[1].id,
        shoes_id: closet[2].id,
      }),
    );
  });

  it('goes back a step', async () => {
    renderWithProviders(<Onboarding onComplete={vi.fn()} />);
    click(/Get started/);
    click('Back');
    expect(screen.getByRole('heading', { name: 'Welcome to FitFinder' })).toBeInTheDocument();
  });
});
