import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, within } from '@testing-library/react';
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

vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

import Closet from '@/components/Closet';
import { describeItem, ticketNumber } from '@/lib/itemLabels';

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
    expect(await screen.findByText('7 items, 2 in the wash')).toBeTruthy();
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

  it('shows Clear filters once a filter is active', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Dirty' }));
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeTruthy();
  });

  it('labels the filter dropdowns', async () => {
    renderWithProviders(<Closet onAddItem={vi.fn()} />);
    expect(await screen.findByLabelText('Category')).toBeTruthy();
    expect(screen.getByLabelText('Color')).toBeTruthy();
  });
});

describe('Closet sections', () => {
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
    await screen.findByRole('heading', { name: 'Tops' });
    const toggle = screen.getByRole('button', { name: 'Hide empty types' });
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

  it('gives each item a stable four-digit ticket number', () => {
    expect(ticketNumber('cd8525fd-2138-427a-8604-fd9d12a7cffa')).toMatch(/^\d{4}$/);
    expect(ticketNumber('abc')).toBe(ticketNumber('abc'));
    // An outfit's number (joined ids) must not just echo its first item's number.
    expect(ticketNumber('aaaaaaaa-1' + 'bbbb')).not.toBe(ticketNumber('aaaaaaaa-1'));
  });
});
