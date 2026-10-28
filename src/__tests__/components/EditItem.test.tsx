import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import EditItem from '@/components/EditItem';
import { renderWithProviders } from '../utils/renderWithProviders';
import { makeTop } from '../factories/clothingItem';

// Stable, as the real useAuth keeps it (a new object per render reloads data).
const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: mockUser })),
}));

const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

const mockReplaceImage = vi.hoisted(() => vi.fn(() => Promise.resolve('u1/new.png')));
vi.mock('@/lib/uploadPipeline', () => ({ replaceItemImage: mockReplaceImage }));
vi.mock('@/lib/clothingImages', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/clothingImages')>()),
  getClothingImageUrl: vi.fn((url: string) => Promise.resolve(`signed:${url}`)),
}));
// The real cropper needs a canvas; this one hands back a blob on click.
vi.mock('@/components/ui/ImageCropper', () => ({
  default: ({ onCropComplete }: { onCropComplete: (b: Blob) => void }) => (
    <button onClick={() => onCropComplete(new Blob(['png']))}>Apply test crop</button>
  ),
}));
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
    expect(screen.getByRole('button', { name: 'Type: T-Shirt' })).toBeTruthy();
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

  it('offers re-cropping, but not replacing the photo', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    expect(screen.getByRole('button', { name: /Adjust \/ crop/ })).toBeTruthy();
    expect(screen.queryByText('New photo')).toBeNull();
    expect(screen.queryByText('Revert to original')).toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("re-crops the photo and saves it as the item's new photo", async () => {
    const onItemUpdated = vi.fn();
    renderWithProviders(
      <EditItem isOpen={true} onClose={vi.fn()} item={item} onItemUpdated={onItemUpdated} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Adjust \/ crop/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Apply test crop' }));
    await waitFor(() =>
      expect(mockReplaceImage).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: item.id, oldImageUrl: item.image_url, userId: 'u1' }),
      ),
    );
    expect(await screen.findByText('Photo updated.')).toBeTruthy();
    expect(onItemUpdated).toHaveBeenCalled();
  });

  it('shows the main and second colour swatches at the same size', () => {
    renderWithProviders(<EditItem isOpen={true} onClose={vi.fn()} item={item} />);
    const [main, second] = screen.getAllByRole('button', { name: 'Red' });
    const size = (el: HTMLElement) => el.className.match(/\bw-\d+ h-\d+\b/)?.[0];
    expect(size(second)).toBe(size(main));
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
