import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// A stable user object, as the real useAuth keeps it: a new object on every
// render would re-run the component's data load forever.
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

// Mock fetchWeather to avoid real network calls
vi.mock('@/lib/weatherApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/weatherApi')>();
  return {
    ...actual,
    fetchWeather: vi.fn(() => Promise.resolve(null)),
  };
});

// Rows a test puts here are returned for that table; every other query
// resolves empty. `mockSingle` is what maybeSingle gives for a table.
const mockRows = vi.hoisted(() => ({}) as Record<string, unknown[]>);
const mockSingle = vi.hoisted(() => ({}) as Record<string, unknown>);
// Every upsert, insert and update, by table.
const mockUpserts = vi.hoisted(() => [] as { table: string; row: unknown }[]);
const mockWrites = vi.hoisted(() => [] as { table: string; op: string; row: unknown }[]);

// A chainable builder where any filter or modifier returns the builder,
// awaiting it gives the table's rows, and maybeSingle/single give null.
const mockFrom = vi.hoisted(() => {
  const builder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {};
    for (const m of [
      'select',
      'eq',
      'neq',
      'gte',
      'lt',
      'lte',
      'in',
      'not',
      'is',
      'order',
      'limit',
    ]) {
      b[m] = () => b;
    }
    b.maybeSingle = () => Promise.resolve({ data: mockSingle[table] ?? null, error: null });
    b.single = () => Promise.resolve({ data: { id: 'new-outfit' }, error: null });
    b.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: mockRows[table] ?? [], error: null });
    b.insert = (row: unknown) => {
      mockWrites.push({ table, op: 'insert', row });
      return b;
    };
    b.update = (row: unknown) => {
      mockWrites.push({ table, op: 'update', row });
      return b;
    };
    b.delete = () => b;
    b.upsert = (row: unknown) => {
      mockUpserts.push({ table, row });
      return Promise.resolve({ error: null });
    };
    return b;
  };
  return vi.fn((table: string) => builder(table));
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: mockFrom,
  },
}));

// The share card is drawn on a canvas, which jsdom lacks.
const mockShare = vi.hoisted(() => ({
  renderShareCard: vi.fn(() => Promise.resolve(new Blob(['png']))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));
vi.mock('@/lib/shareCard', () => mockShare);
vi.mock('@/lib/clothingImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/clothingImages')>()),
  getClothingImageUrl: vi.fn((url: string) => Promise.resolve(`signed:${url}`)),
}));

import OutfitGenerator from '@/components/OutfitGenerator';
import { fetchWeather } from '@/lib/weatherApi';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';

describe('OutfitGenerator', () => {
  beforeEach(() => {
    mockFrom.mockClear();
    for (const table of Object.keys(mockRows)) delete mockRows[table];
    for (const table of Object.keys(mockSingle)) delete mockSingle[table];
    mockUpserts.length = 0;
    mockWrites.length = 0;
  });

  it('renders the Generator tab', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.queryByText(/Loading/)).toBeNull();
      },
      { timeout: 3000 },
    );
  });

  it('shows the Generate button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: 'Generate outfit' })).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('clicking Generate triggers outfit generation', async () => {
    renderWithProviders(<OutfitGenerator />);
    const generate = await screen.findByRole('button', { name: 'Generate outfit' });
    fireEvent.click(generate);
    expect(
      screen.getByRole('button', { name: /^(Generate outfit|Try another outfit)$/ }),
    ).toBeTruthy();
  });

  it('shows Saved tab button', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.queryAllByText(/Saved/).length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );
  });

  it('shows Weather section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText('Weather')).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows the Occasion section heading', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Occasion' })).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows Save outfit and Wear today buttons', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /Save outfit/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Wear today/ })).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('links to the calendar', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText("See what you've worn")).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('calendar link calls onNavigateToCalendar', async () => {
    const onNav = vi.fn();
    renderWithProviders(<OutfitGenerator onNavigateToCalendar={onNav} />);
    await waitFor(() => screen.getByText("See what you've worn"), { timeout: 3000 });
    fireEvent.click(screen.getByText("See what you've worn"));
    expect(onNav).toHaveBeenCalledTimes(1);
  });

  it('switching to Saved tab shows empty state', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(() => screen.queryAllByText(/Saved/).length > 0, { timeout: 3000 });
    const savedBtns = screen.queryAllByText(/Saved/);
    if (savedBtns.length > 0) {
      fireEvent.click(savedBtns[0]);
      await waitFor(
        () => {
          expect(screen.queryAllByText(/No saved outfits|saved/i).length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
    }
  });

  it('shows zip code prompt when no weather data', async () => {
    renderWithProviders(<OutfitGenerator />);
    await waitFor(
      () => {
        expect(screen.getByText(/zip code/i)).toBeTruthy();
      },
      { timeout: 3000 },
    );
  });

  it('shows every outfit once before repeating any', async () => {
    // 2 tops × 2 bottoms × 1 pair of shoes = 4 outfits, all scoring the same.
    mockRows.clothing_items = [
      makeTop({ colors: ['red'] }),
      makeTop({ colors: ['green'] }),
      makeBottom({ colors: ['black'] }),
      makeBottom({ colors: ['beige'] }),
      makeShoes(),
    ];
    renderWithProviders(<OutfitGenerator />);
    const piece = (part: string) =>
      screen
        .getByRole('button', { name: new RegExp(`^Change ${part}: `) })
        .getAttribute('aria-label');

    const shown: string[] = [];
    for (let i = 0; i < 4; i++) {
      const button = await screen.findByRole('button', {
        name: /^(Generate outfit|Try another outfit)$/,
      });
      fireEvent.click(button);
      await waitFor(() => expect(piece('top')).toBeTruthy());
      shown.push(`${piece('top')} + ${piece('bottom')}`);
    }
    expect(new Set(shown).size).toBe(4);
  });

  it('learns from "Try another" on a generated outfit, not on the first Generate', async () => {
    mockRows.clothing_items = [makeTop(), makeTop(), makeBottom(), makeShoes()];
    renderWithProviders(<OutfitGenerator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
    await screen.findByRole('button', { name: 'Try another outfit' });
    expect(mockUpserts.filter((u) => u.table === 'outfit_model_weights')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Try another outfit' }));
    await waitFor(() =>
      expect(mockUpserts.filter((u) => u.table === 'outfit_model_weights')).toHaveLength(1),
    );
    const { feature_meta } = mockUpserts[0].row as { feature_meta: { updates: number } };
    // A skip isn't a rating.
    expect(feature_meta.updates).toBe(0);
  });

  it('logs each shown outfit, and records a skip as its outcome', async () => {
    mockRows.clothing_items = [makeTop(), makeTop(), makeBottom(), makeShoes()];
    renderWithProviders(<OutfitGenerator />);
    const impressions = () => mockWrites.filter((w) => w.table === 'outfit_impressions');

    fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
    await waitFor(() => expect(impressions()).toHaveLength(1));
    expect(impressions()[0]).toMatchObject({ op: 'insert', row: { model_ratings: 0 } });

    fireEvent.click(screen.getByRole('button', { name: 'Try another outfit' }));
    // The next outfit is logged; the skip is recorded once the first insert's
    // id is back.
    await waitFor(() =>
      expect(
        impressions()
          .map((w) => w.op)
          .sort(),
      ).toEqual(['insert', 'insert', 'update']),
    );
    expect(impressions().find((w) => w.op === 'update')?.row).toMatchObject({ outcome: 'skipped' });
  });

  describe('swapping one piece', () => {
    const piece = (part: string) =>
      screen
        .getByRole('button', { name: new RegExp(`^Change ${part}: `) })
        .getAttribute('aria-label');

    async function generated() {
      renderWithProviders(<OutfitGenerator />);
      fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
      await screen.findByRole('button', { name: 'Try another outfit' });
    }

    it('changes only that piece, with either arrow', async () => {
      mockRows.clothing_items = [
        makeTop({ colors: ['red'] }),
        makeTop({ colors: ['green'] }),
        makeTop({ colors: ['blue'] }),
        makeBottom(),
        makeShoes(),
      ];
      await generated();
      for (const direction of ['slide right', 'slide left']) {
        const before = { top: piece('top'), bottom: piece('bottom'), shoes: piece('shoes') };
        fireEvent.click(screen.getByRole('button', { name: `Swap top (${direction})` }));
        await waitFor(() => expect(piece('top')).not.toBe(before.top));
        expect(piece('bottom')).toBe(before.bottom);
        expect(piece('shoes')).toBe(before.shoes);
      }
    });

    it('learns the swap like a skip of the outfit as shown', async () => {
      mockRows.clothing_items = [makeTop(), makeTop(), makeBottom(), makeShoes()];
      await generated();
      const impressions = () => mockWrites.filter((w) => w.table === 'outfit_impressions');
      await waitFor(() => expect(impressions()).toHaveLength(1));

      fireEvent.click(screen.getByRole('button', { name: 'Swap top (slide left)' }));
      await waitFor(() =>
        expect(mockUpserts.filter((u) => u.table === 'outfit_model_weights')).toHaveLength(1),
      );
      await waitFor(() =>
        expect(impressions().find((w) => w.op === 'update')?.row).toMatchObject({
          outcome: 'skipped',
        }),
      );
    });

    it('says so when nothing else goes with the rest of the outfit', async () => {
      mockRows.clothing_items = [makeTop(), makeTop(), makeBottom(), makeShoes()];
      await generated();
      const shoes = piece('shoes');
      fireEvent.click(screen.getByRole('button', { name: 'Swap shoes (slide right)' }));
      expect(
        await screen.findByText(
          'No other pair of shoes goes with the rest of this outfit right now.',
        ),
      ).toBeTruthy();
      expect(piece('shoes')).toBe(shoes);
      // Nothing was swapped, so it isn't a pass on the outfit.
      expect(mockUpserts.filter((u) => u.table === 'outfit_model_weights')).toHaveLength(0);
      expect(
        mockWrites.filter((w) => w.table === 'outfit_impressions' && w.op === 'update'),
      ).toHaveLength(0);
    });

    it("can't swap a kept piece", async () => {
      mockRows.clothing_items = [makeTop(), makeTop(), makeBottom(), makeShoes()];
      await generated();
      fireEvent.click(screen.getByRole('button', { name: 'Lock top' }));
      expect(
        (screen.getByRole('button', { name: 'Swap top (slide left)' }) as HTMLButtonElement)
          .disabled,
      ).toBe(true);
      expect(
        (screen.getByRole('button', { name: 'Swap bottom (slide left)' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false);
    });
  });

  it('asks for a rating beside the outfit once there is one to rate', async () => {
    mockRows.clothing_items = [makeTop(), makeBottom(), makeShoes()];
    renderWithProviders(<OutfitGenerator />);
    expect(await screen.findByText(/Generate an outfit, then rate it here/)).toBeTruthy();
    expect(screen.queryByRole('group', { name: /Rate this outfit/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate outfit' }));
    expect(await screen.findByRole('group', { name: /Rate this outfit/ })).toBeTruthy();
  });

  it("shows the outfit's palette once it lands, and themes the screen from it", async () => {
    mockRows.clothing_items = [
      makeTop({ colors: ['navy blue'] }),
      makeBottom({ colors: ['beige'] }),
      makeShoes({ colors: ['white'] }),
    ];
    const { container } = renderWithProviders(<OutfitGenerator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
    expect(container.querySelector('.outfit-scope')).toBeTruthy();
    expect(
      await screen.findByText('Navy Blue · Beige · White', {}, { timeout: 4000 }),
    ).toBeTruthy();
  });

  it("warms the outfit's glow while a high rating is pointed at", async () => {
    mockRows.clothing_items = [makeTop(), makeBottom(), makeShoes()];
    renderWithProviders(<OutfitGenerator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
    const outfit = screen.getByRole('region', { name: 'Your outfit' });
    expect(outfit.style.boxShadow).toBe('');
    fireEvent.mouseEnter(await screen.findByRole('button', { name: '9 out of 10' }));
    expect(outfit.style.boxShadow).toContain('rgba(255, 140, 40, 0.56)');
  });

  it('stamps the outfit into today after Wear today', async () => {
    mockRows.clothing_items = [makeTop(), makeBottom(), makeShoes()];
    renderWithProviders(<OutfitGenerator />);
    fireEvent.click(await screen.findByRole('button', { name: 'Generate outfit' }));
    expect(screen.queryByTestId('worn-stamp')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Wear today/ }));
    expect(await screen.findByTestId('worn-stamp')).toBeTruthy();
    expect(mockWrites.some((w) => w.table === 'outfit_wears' && w.op === 'insert')).toBe(true);
  });

  it("shows today's weather behind the screen, until you stop dressing for it", async () => {
    mockSingle.profiles = { zip_code: '10001' };
    vi.mocked(fetchWeather).mockResolvedValueOnce({
      temperature: 48,
      highTemperature: 52,
      condition: 'Rain',
      description: 'light rain',
      icon: '10d',
      humidity: 80,
      windSpeed: 5,
      timestamp: 0,
      zipCode: '10001',
    });
    renderWithProviders(<OutfitGenerator />);
    const backdrop = await screen.findByTestId('weather-backdrop');
    expect(backdrop.dataset.scene).toBe('rainy');
    fireEvent.click(screen.getByRole('switch', { name: /Dress for the weather/ }));
    expect(screen.queryByTestId('weather-backdrop')).toBeNull();
  });

  it('shows no weather backdrop without a ZIP code', async () => {
    renderWithProviders(<OutfitGenerator />);
    await screen.findByText(/Add your ZIP code/);
    expect(screen.queryByTestId('weather-backdrop')).toBeNull();
  });

  it('shares an image of the outfit: its photos, palette and the date', async () => {
    mockRows.clothing_items = [
      makeTop({ colors: ['navy blue'], image_url: 'u1/top.png' }),
      makeBottom({ colors: ['beige'], image_url: 'u1/bottom.png' }),
      makeShoes({ colors: ['white'], image_url: 'u1/shoes.png' }),
    ];
    renderWithProviders(<OutfitGenerator />);
    const share = await screen.findByRole('button', { name: 'Share outfit' });
    expect((share as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Generate outfit' }));
    fireEvent.click(share);
    await waitFor(() => expect(mockShare.shareOrDownload).toHaveBeenCalled());
    const card = (mockShare.renderShareCard.mock.calls[0] as unknown[])[0] as {
      images: string[];
      palette: string[];
    };
    expect(card.images).toEqual([
      'signed:u1/top.png',
      'signed:u1/bottom.png',
      'signed:u1/shoes.png',
    ]);
    expect(card.palette).toEqual(['#1f2a4a', expect.any(String), '#fafaf7']);
    expect((mockShare.shareOrDownload.mock.calls[0] as unknown[])[1]).toMatch(
      /^fitfinder-outfit-\d{4}-\d{2}-\d{2}\.png$/,
    );
    expect(await screen.findByText('Saved an image of your outfit.')).toBeTruthy();
  });

  it('picks up a ZIP code saved in Settings when the tab is shown again', async () => {
    const { rerender } = renderWithProviders(<OutfitGenerator active />);
    expect(await screen.findByText(/Add your ZIP code in Settings/)).toBeTruthy();

    // Away in Settings, the user saves a ZIP code.
    rerender(<OutfitGenerator active={false} />);
    mockSingle.profiles = { zip_code: '10001' };
    vi.mocked(fetchWeather).mockResolvedValueOnce({
      temperature: 61,
      highTemperature: 64,
      condition: 'Clear',
      description: 'clear sky',
      icon: '01d',
      humidity: 40,
      windSpeed: 3,
      timestamp: 0,
      zipCode: '10001',
    });
    rerender(<OutfitGenerator active />);

    expect(await screen.findByText('61°F')).toBeTruthy();
    expect(screen.queryByText(/Add your ZIP code in Settings/)).toBeNull();
    expect(fetchWeather).toHaveBeenLastCalledWith('10001');
  });

  it("says when the weather can't be loaded for a saved ZIP code", async () => {
    mockSingle.profiles = { zip_code: '10001' };
    vi.mocked(fetchWeather).mockResolvedValueOnce(null);
    renderWithProviders(<OutfitGenerator />);
    expect(await screen.findByText("Couldn't load the weather for 10001 right now.")).toBeTruthy();
  });
});
