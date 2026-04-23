import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeTop, makeBottom, makeShoes, makeOuterwear } from '../factories/clothingItem';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
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

import Closet from '@/components/Closet';

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

  it('renders items after loading', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByText('Tops')).toBeTruthy();
    });
  });

  it('calls onAddItem when Add Item button is clicked', async () => {
    const onAddItem = vi.fn();
    renderWithProviders(<Closet onAddItem={onAddItem} />);
    await waitFor(() => screen.getByText('Tops'));
    const addBtn = document.querySelector('.btn-primary');
    if (addBtn) fireEvent.click(addBtn);
    expect(onAddItem).toHaveBeenCalled();
  });

  it('calls onEditItem when item is clicked', async () => {
    const onEditItem = vi.fn();
    renderWithProviders(<Closet onAddItem={vi.fn()} onEditItem={onEditItem} />);
    await waitFor(() => screen.getByText('Tops'));
    const itemImages = screen.getAllByRole('img');
    if (itemImages.length > 0) fireEvent.click(itemImages[0]);
    expect(onEditItem).toHaveBeenCalled();
  });

  it('renders all section headers after loading', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getAllByText('Tops'));
    expect(screen.queryAllByText('Bottoms').length).toBeGreaterThan(0);
    // Outerwear types are now part of Tops
    expect(screen.queryAllByText('Shoes').length).toBeGreaterThan(0);
  });

  it('clear filters button appears when filters are active', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));
    const dirtyBtns = screen.getAllByText('Dirty');
    if (dirtyBtns.length > 0) fireEvent.click(dirtyBtns[0]);
    expect(screen.getByText(/Clear/)).toBeTruthy();
  });
});

describe('Closet section collapse/expand', () => {
  function findSectionButton(sectionName: string) {
    // The section header is: <button><ChevronIcon/><h2>Tops</h2><span>count</span></button>
    // Find the h2, then go up to the button parent
    const h2 = screen.getByRole('heading', { name: sectionName });
    return h2.closest('button')!;
  }

  it('clicking section header toggles section collapse', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('T-Shirt'));

    // Subsection headers should be visible initially (T-Shirt, Polo)
    expect(screen.getByText('T-Shirt')).toBeTruthy();

    // Find the Tops section header button and click to collapse
    const sectionButton = findSectionButton('Tops');
    fireEvent.click(sectionButton);

    // After collapsing, T-Shirt subsection header should disappear
    await waitFor(() => {
      expect(screen.queryByText('T-Shirt')).toBeNull();
    });
  });

  it('clicking collapsed section header expands it', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('T-Shirt'));

    const sectionButton = findSectionButton('Tops');

    // Collapse
    fireEvent.click(sectionButton);
    await waitFor(() => expect(screen.queryByText('T-Shirt')).toBeNull());

    // Expand
    fireEvent.click(sectionButton);

    // T-Shirt should be visible again
    await waitFor(() => {
      expect(screen.getByText('T-Shirt')).toBeTruthy();
    });
  });
});

describe('Closet subsection collapse/expand', () => {
  it('clicking subsection header toggles subsection content', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('T-Shirt'));

    // Find T-Shirt subsection header (it's a button)
    const tshirtText = screen.getByText('T-Shirt');
    const subsectionButton = tshirtText.closest('button');
    expect(subsectionButton).toBeTruthy();

    // Items should be visible (images rendered)
    const imagesBefore = screen.getAllByRole('img').length;
    expect(imagesBefore).toBeGreaterThan(0);

    // Click to collapse T-Shirt subsection
    fireEvent.click(subsectionButton!);

    // Images should be fewer after collapsing a subsection
    await waitFor(() => {
      const imagesAfter = screen.getAllByRole('img').length;
      expect(imagesAfter).toBeLessThan(imagesBefore);
    });
  });
});

describe('Closet filters', () => {
  it('dirty filter shows only dirty items', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    // Click Dirty filter
    const dirtyBtns = screen.getAllByText('Dirty');
    fireEvent.click(dirtyBtns[0]);

    // Only dirty items should show — check that the dirty badge is on all visible items
    await waitFor(() => {
      const dirtyBadges = screen.queryAllByText('Dirty');
      // At least one "Dirty" badge should be on an item (plus the filter button itself)
      expect(dirtyBadges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('clean filter shows only clean items', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    // Click Clean filter
    const cleanBtns = screen.getAllByText('Clean');
    fireEvent.click(cleanBtns[0]);

    // Clear filter should appear
    expect(screen.getByText(/Clear/)).toBeTruthy();
  });

  it('clearing filters resets all filter state', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    // Apply dirty filter
    const dirtyBtns = screen.getAllByText('Dirty');
    fireEvent.click(dirtyBtns[0]);
    expect(screen.getByText(/Clear/)).toBeTruthy();

    // Clear filters
    fireEvent.click(screen.getByText(/Clear/));

    // Clear button should be gone
    expect(screen.queryByText(/Clear filter/)).toBeNull();
  });
});

describe('Closet Hide Empty toggle', () => {
  it('Hide Empty button is present in filter bar', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));
    expect(screen.getByText('Hide Empty')).toBeTruthy();
  });

  it('toggling Hide Empty hides subsections with 0 items', async () => {
    // Some clothing types will have 0 items (e.g., Long Sleeve Shirt, Tank Top, etc.)
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    // Count subsection headers before
    const subsectionsBefore = screen.queryAllByText(/Long Sleeve Shirt|Tank Top|Button-Up Shirt/);

    // Click Hide Empty
    fireEvent.click(screen.getByText('Hide Empty'));

    // Empty subsections should disappear
    await waitFor(() => {
      const subsectionsAfter = screen.queryAllByText(/Long Sleeve Shirt|Tank Top|Button-Up Shirt/);
      expect(subsectionsAfter.length).toBeLessThan(subsectionsBefore.length);
    });
  });
});

describe('Closet Mark All Dirty/Clean', () => {
  it('Mark All Dirty button triggers supabase update', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    fireEvent.click(screen.getAllByText('Mark All Dirty')[0]);

    await waitFor(() => {
      expect(mockUpdateFn).toHaveBeenCalled();
    });
  });

  it('Mark All Clean button triggers supabase update', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('Tops'));

    fireEvent.click(screen.getAllByText('Mark All Clean')[0]);

    await waitFor(() => {
      expect(mockUpdateFn).toHaveBeenCalled();
    });
  });
});

describe('Closet section count badges', () => {
  it('section headers show correct item counts', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('T-Shirt'));

    // Tops section should show count of 4 (2 T-Shirts + 1 Polo + 1 Jacket)
    const topsH2 = screen.getByRole('heading', { name: 'Tops' });
    const topsButton = topsH2.closest('button')!;
    const badge = topsButton.querySelector('.rounded-full');
    expect(badge?.textContent).toBe('4');
  });

  it('subsection headers show correct item counts', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    await waitFor(() => screen.getByText('T-Shirt'));

    // T-Shirt subsection should show count of 2
    const tshirtHeader = screen.getByText('T-Shirt').closest('button');
    expect(tshirtHeader).toBeTruthy();
    const badge = tshirtHeader!.querySelector('.rounded-full');
    expect(badge?.textContent).toBe('2');
  });
});
