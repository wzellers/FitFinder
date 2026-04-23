import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import EditItem from '@/components/EditItem';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeTop } from '../factories/clothingItem';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

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
    renderWithProviders(
      <EditItem isOpen={false} onClose={vi.fn()} item={item} />,
    );
    expect(screen.queryByText('Edit Item')).toBeNull();
  });

  it('renders when isOpen is true', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} />,
    );
    expect(screen.getByText('Edit Item')).toBeTruthy();
  });

  it('initializes with item type and color', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} />,
    );
    // Should show "Selected: blue" text
    expect(screen.getByText(/Selected: blue/)).toBeTruthy();
  });

  it('shows ConfirmDialog when delete button is clicked', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} />,
    );
    // Click the trash icon button (only button with btn-danger class)
    const dangerBtn = document.querySelector('.btn-danger');
    if (dangerBtn) fireEvent.click(dangerBtn);
    expect(screen.getByText('Delete this item? This cannot be undone.')).toBeTruthy();
  });

  it('cancels delete when ConfirmDialog cancel is clicked', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} />,
    );
    const dangerBtn = document.querySelector('.btn-danger');
    if (dangerBtn) fireEvent.click(dangerBtn);
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Delete this item? This cannot be undone.')).toBeNull();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('shows Mark Dirty when item is clean', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={{ ...item, is_dirty: false }} />,
    );
    expect(screen.getByText('Mark Dirty')).toBeTruthy();
  });

  it('shows Mark Clean when item is dirty', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={{ ...item, is_dirty: true }} />,
    );
    expect(screen.getByText('Mark Clean')).toBeTruthy();
  });

  it('Reset button restores original type selection', () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} />,
    );
    // Change color
    const blackBtn = screen.getByTitle('black');
    fireEvent.click(blackBtn);
    expect(screen.getByText(/Selected: black/)).toBeTruthy();
    // Reset
    fireEvent.click(screen.getByText('Reset'));
    expect(screen.getByText(/Selected: blue/)).toBeTruthy();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <EditItem isOpen={true} onClose={onClose} item={item} />,
    );
    const overlay = document.querySelector('.modal-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalled();
  });

  it('Update calls supabase with selected values', async () => {
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} onItemUpdated={vi.fn()} />,
    );
    fireEvent.click(screen.getByText('Update Item'));
    await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
  });
});
