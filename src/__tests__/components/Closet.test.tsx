import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeTop, makeBottom, makeShoes, makeOuterwear } from '../factories/clothingItem';

// Stable, as the real useAuth keeps it (a new object per render reloads data).
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockSelectFn = vi.hoisted(() => vi.fn());
const mockUpdateFn = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: mockSelectFn,
      update: vi.fn(() => ({
        eq: mockUpdateFn,
      })),
    })),
  },
}));

vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

import Closet from '@/components/Closet';
import { describeItem } from '@/lib/itemLabels';

const items = [
  makeTop({ id: 't1', type: 'T-Shirt', colors: ['blue'], is_dirty: false }),
  makeTop({ id: 't2', type: 'T-Shirt', colors: ['red'], is_dirty: false }),
  makeTop({ id: 't3', type: 'Polo', colors: ['green'], is_dirty: true }),
  makeBottom({ id: 'b1', type: 'Jeans', colors: ['navy blue'], is_dirty: true }),
  makeBottom({ id: 'b2', type: 'Shorts', colors: ['khaki'], is_dirty: false }),
  makeOuterwear({ id: 'o1', type: 'Jacket', colors: ['black'], is_dirty: false }),
  makeShoes({ id: 's1', type: 'Shoes', colors: ['white'], is_dirty: false }),
];

beforeEach(() => {
  localStorage.clear();
  mockSelectFn.mockReturnValue({
    eq: vi.fn(() => ({
      order: vi.fn(() => Promise.resolve({ data: items, error: null })),
    })),
  });
  mockUpdateFn.mockResolvedValue({ error: null });
});

describe('Closet', () => {
  it('shows loading skeleton initially', () => {
    mockSelectFn.mockReturnValue({
      eq: vi.fn(() => ({
        order: vi.fn(() => new Promise(() => {})),
      })),
    });
    const { container } = renderWithProviders(<Closet onAddItem={vi.fn()} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders every section after loading', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Tops' });
    expect(screen.getByRole('heading', { name: 'Bottoms' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Shoes' })).toBeTruthy();
  });

  it('summarises the closet', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    expect(await screen.findByText('{ 7 items · 2 in the wash }')).toBeTruthy();
  });

  it('calls onAddItem from the Add item button', async () => {
    const onAddItem = vi.fn();
    renderWithProviders(<Closet onAddItem={onAddItem} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add item' }));
    expect(onAddItem).toHaveBeenCalled();
  });

  it('opens the editor when a tag is clicked', async () => {
    const onEditItem = vi.fn();
    renderWithProviders(<Closet onAddItem={vi.fn()} onEditItem={onEditItem} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Blue T-Shirt' }));
    expect(onEditItem).toHaveBeenCalledWith(expect.objectContaining({ id: 't1' }));
  });

  it('highlights items that were just added', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} highlightIds={['t2']} />);
    const added = await screen.findByRole('button', { name: 'Edit Red T-Shirt' });
    expect(added.closest('[data-just-added]')).toBeTruthy();
    const other = screen.getByRole('button', { name: 'Edit Blue T-Shirt' });
    expect(other.closest('[data-just-added]')).toBeNull();
  });

  it('shows Clear filters once a filter is active', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dirty' }));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('filters with dropdowns in the app style', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Category: All categories' }));
    fireEvent.click(screen.getByRole('option', { name: 'Bottoms' }));
    expect(screen.getByRole('button', { name: 'Category: Bottoms' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit Blue T-Shirt' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Color: All colors' }));
    // Colours show their swatch.
    const navy = screen.getByRole('option', { name: 'Navy Blue' });
    expect(navy.querySelector('[aria-hidden="true"]')).toBeTruthy();
    fireEvent.click(navy);
    expect(screen.getByRole('button', { name: /^Edit .*Jeans$/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Edit .*Shorts$/ })).toBeNull();
  });

  it('collapses and expands a section, exposing aria-expanded', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await screen.findByRole('button', { name: 'Edit Blue T-Shirt' });
    const header = screen.getByRole('heading', { name: 'Tops' }).closest('button')!;
    expect(header.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(header);
    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('button', { name: 'Edit Blue T-Shirt' })).toBeNull();
    fireEvent.click(header);
    expect(screen.getByRole('button', { name: 'Edit Blue T-Shirt' })).toBeTruthy();
  });

  it('collapses a type within a section', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await screen.findByRole('button', { name: 'Edit Blue T-Shirt' });
    const typeHeader = screen
      .getAllByRole('button', { expanded: true })
      .find((b) => b.textContent?.startsWith('T-Shirt'))!;
    fireEvent.click(typeHeader);
    expect(screen.queryByRole('button', { name: 'Edit Blue T-Shirt' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Green Polo' })).toBeTruthy();
  });

  it('hides empty types by default and lists them as quick-add chips', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    // Wait for the loaded closet, not the loading skeleton (which also shows
    // a "Tops" heading).
    const toggle = await screen.findByRole('button', { name: 'Hide empty types' });
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '+ Tank Top' })).toBeTruthy();

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('button', { name: '+ Tank Top' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add tank top' })).toBeTruthy();
  });
});

describe('Closet laundry', () => {
  it('confirms before marking everything dirty', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all dirty' }));
    expect(mockUpdateFn).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark all dirty' }));
    await waitFor(() => expect(mockUpdateFn).toHaveBeenCalledWith('user_id', 'u1'));
  });

  it('confirms before marking everything clean', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /Mark all clean/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark all clean' }));
    await waitFor(() => expect(mockUpdateFn).toHaveBeenCalledWith('user_id', 'u1'));
  });

  it('stamps a single item dirty from its tag', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Blue T-Shirt is clean. Mark as dirty' }),
    );
    expect(
      screen.getByRole('button', { name: 'Blue T-Shirt is dirty. Mark as clean' }),
    ).toBeTruthy();
    await waitFor(() => expect(mockUpdateFn).toHaveBeenCalledWith('id', 't1'));
  });

  it('puts the stamp back if saving fails', async () => {
    mockUpdateFn.mockResolvedValue({ error: { message: 'nope' } });
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Blue T-Shirt is clean. Mark as dirty' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Blue T-Shirt is clean. Mark as dirty' }),
    ).toBeTruthy();
  });
});

describe('Closet helpers', () => {
  it('describes an item by colors and type', () => {
    expect(describeItem(makeTop({ type: 'Polo', colors: ['navy blue', 'white'] }))).toBe(
      'Navy blue and white Polo',
    );
  });

  describe('ordering', () => {
    const tees = [
      makeTop({ id: 'a', type: 'T-Shirt', colors: ['white'], is_dirty: true, position: 1 }),
      makeTop({ id: 'b', type: 'T-Shirt', colors: ['red'], is_dirty: false, position: 3 }),
      makeTop({ id: 'c', type: 'T-Shirt', colors: ['blue'], is_dirty: false, position: 2 }),
    ];
    beforeEach(() => {
      mockSelectFn.mockReturnValue({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: tees, error: null })),
        })),
      });
    });

    const tileOrder = () =>
      screen
        .getAllByRole('button', { name: /^Edit .*T-Shirt$/ })
        .map((b) => b.getAttribute('aria-label'));

    it('shows pieces in the saved order, with dirty ones at the end', async () => {
      renderWithProviders(<Closet onAddItem={vi.fn()} />);
      await screen.findByRole('button', { name: 'Edit Blue T-Shirt' });
      expect(tileOrder()).toEqual(['Edit Blue T-Shirt', 'Edit Red T-Shirt', 'Edit White T-Shirt']);
    });

    it('lets clean pieces be dragged, but not dirty ones', async () => {
      renderWithProviders(<Closet onAddItem={vi.fn()} />);
      expect(await screen.findByRole('button', { name: 'Reorder Blue T-Shirt' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Reorder Red T-Shirt' })).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Reorder White T-Shirt' })).toBeNull();
    });

    it('moves a piece to the end when it gets dirty', async () => {
      renderWithProviders(<Closet onAddItem={vi.fn()} />);
      await screen.findByRole('button', { name: 'Edit Blue T-Shirt' });
      const blue = screen.getByRole('button', { name: 'Edit Blue T-Shirt' }).closest('li')!;
      fireEvent.click(within(blue).getByRole('button', { name: /Mark .* dirty/ }));
      await waitFor(() =>
        expect(tileOrder()).toEqual([
          'Edit Red T-Shirt',
          'Edit White T-Shirt',
          'Edit Blue T-Shirt',
        ]),
      );
    });

    it('pauses reordering while a filter shows only part of a group', async () => {
      renderWithProviders(<Closet onAddItem={vi.fn()} />);
      await screen.findByRole('button', { name: 'Reorder Blue T-Shirt' });
      fireEvent.click(screen.getByRole('button', { name: 'Clean' }));
      expect(screen.queryByRole('button', { name: /^Reorder / })).toBeNull();
    });
  });
});
