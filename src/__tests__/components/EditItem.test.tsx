import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import EditItem from '@/components/EditItem';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeTop } from '../factories/clothingItem';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock('@/components/ui/ClothingImage', () => ({
  default: ({ alt }: { alt?: string }) => <img alt={alt} />,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      update: vi.fn(() => ({ eq: mockUpdate })),
      delete: vi.fn(() => ({ eq: mockDelete })),
    })),
  },
}));

const item = makeTop({ id: 'item-123', type: 'T-Shirt', colors: ['blue'], is_dirty: false });

beforeEach(() => {
  mockUpdate.mockResolvedValue({ error: null });
  mockDelete.mockResolvedValue({ error: null });
  mockEq.mockResolvedValue({ error: null });
});

describe('EditItem', () => {
  it('does not render when isOpen is false', () => {
    renderWithProviders(<EditItem isOpen={false} onClose={vi.fn()} item={item} />);
    expect(screen.queryByText('Edit item')).toBeNull();
  });

  it('renders when isOpen is true', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    expect(screen.getByText('Edit item')).toBeTruthy();
  });

  it('initializes with item type and color', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    expect(screen.getAllByRole('button', { name: 'Blue' })[0].getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect((screen.getByLabelText('Type') as HTMLSelectElement).value).toBe('T-Shirt');
  });

  it('shows ConfirmDialog when delete button is clicked', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    expect(screen.getByText(/Delete this t-shirt\?/)).toBeTruthy();
  });

  it('cancels delete when ConfirmDialog cancel is clicked', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete item' }));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText(/Delete this t-shirt\?/)).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('shows Mark Dirty when item is clean', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={{ ...item, is_dirty: false }} />,
    );
    expect(screen.getByRole('button', { name: 'Mark dirty' })).toBeTruthy();
  });

  it('shows Mark Clean when item is dirty', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={{ ...item, is_dirty: true }} />,
    );
    expect(screen.getByRole('button', { name: 'Mark clean' })).toBeTruthy();
  });

  it('Undo changes restores the original values', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    // Change color
    fireEvent.click(screen.getAllByRole('button', { name: 'Black' })[0]);
    expect(screen.getAllByRole('button', { name: 'Black' })[0].getAttribute('aria-pressed')).toBe(
      'true',
    );
    fireEvent.click(screen.getByText('Undo changes'));
    expect(screen.getAllByRole('button', { name: 'Blue' })[0].getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<EditItem isOpen={true} onClose={onClose} item={item} />);
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) fireEvent.mouseDown(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('Update calls supabase with selected values', async () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} onItemUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Save changes'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  });

  it('does not render image-editing controls', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    expect(screen.queryByText('New photo')).toBeNull();
    expect(screen.queryByText('Adjust / crop')).toBeNull();
    expect(screen.queryByText('Revert to original')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it('keeps and edits a second colour', async () => {
    const twoTone = { ...item, colors: ['blue', 'white'] };
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={twoTone} onItemUpdated={vi.fn()} />,
    );
    const secondGroup = screen.getByText('Second color').closest('fieldset')!;
    const white = Array.from(secondGroup.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'White',
    )!;
    expect(white.getAttribute('aria-pressed')).toBe('true');
    // Changing the main colour keeps the second one.
    fireEvent.click(screen.getAllByRole('button', { name: 'Black' })[0]);
    expect(white.getAttribute('aria-pressed')).toBe('true');
  });
});
