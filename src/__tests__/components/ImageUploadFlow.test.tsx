import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

// The adding flow: detection, automatic background removal, chips, the
// lookalike note and highlighting what was added. The pipeline is mocked.

const mockUser = vi.hoisted(() => ({ id: 'u1' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: vi.fn(() => ({ user: mockUser })) }));

const closetRows = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: closetRows.rows, error: null }),
      }),
    })),
  },
}));

const pipeline = vi.hoisted(() => ({
  detectItem: vi.fn(),
  removeImageBackground: vi.fn(),
  uploadItem: vi.fn(),
}));
vi.mock('@/lib/uploadPipeline', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/uploadPipeline')>()),
  ...pipeline,
}));
vi.mock('@imgly/background-removal', () => ({ removeBackground: vi.fn() }));
vi.mock('react-easy-crop', () => ({ default: vi.fn(() => null) }));
vi.mock('next/dynamic', () => ({ default: vi.fn(() => () => null) }));

import ImageUpload from '@/components/ImageUpload';

const photo = () => new File(['x'], 'tee.png', { type: 'image/png' });

function choose(files: File[]) {
  const input = document.querySelector('input[type="file"][multiple]') as HTMLInputElement;
  fireEvent.change(input, { target: { files } });
}

beforeEach(() => {
  localStorage.clear();
  closetRows.rows = [];
  pipeline.detectItem.mockReset().mockResolvedValue({
    suggestedType: 'T-Shirt',
    suggestedSection: 'Tops',
    suggestedColors: ['red'],
  });
  pipeline.removeImageBackground
    .mockReset()
    .mockResolvedValue(new Blob(['cut'], { type: 'image/png' }));
  pipeline.uploadItem.mockReset().mockResolvedValue('new-item');
});

describe('Adding items', () => {
  it('shows what detection found as chips, with the editors tucked away', async () => {
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    expect(await screen.findByRole('button', { name: 'Type: T-Shirt. Edit' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Main color: Red. Edit' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Category:/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Type: T-Shirt. Edit' }));
    expect(screen.getByRole('button', { name: 'Category: Tops' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Type: T-Shirt' })).toBeTruthy();
  });

  it('opens the editors straight away when detection finds nothing', async () => {
    pipeline.detectItem.mockResolvedValue({
      suggestedType: null,
      suggestedSection: '',
      suggestedColors: [],
    });
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    // Required and unset: marked for the user (and screen readers).
    expect(
      await screen.findByRole('button', { name: 'Category: Choose a category (required)' }),
    ).toBeTruthy();
  });

  it('removes backgrounds automatically, with a slider to compare', async () => {
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    expect(await screen.findByLabelText('Compare with the original photo')).toBeTruthy();
    expect(pipeline.removeImageBackground).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('original-overlay').style.clipPath).toBe('inset(0 100% 0 0)');
    fireEvent.change(screen.getByLabelText('Compare with the original photo'), {
      target: { value: '40' },
    });
    expect(screen.getByTestId('original-overlay').style.clipPath).toBe('inset(0 60% 0 0)');
  });

  it('waits for background removal before adding', async () => {
    let finish: (b: Blob) => void = () => {};
    pipeline.removeImageBackground.mockReturnValue(new Promise<Blob>((r) => (finish = r)));
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    const add = await screen.findByRole('button', { name: 'Removing backgrounds…' });
    expect((add as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('scan-line')).toBeTruthy();
    finish(new Blob(['cut']));
    expect(await screen.findByRole('button', { name: 'Add to closet' })).toBeTruthy();
  });

  it('remembers turning automatic removal off', async () => {
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    fireEvent.click(await screen.findByLabelText('Remove backgrounds automatically'));
    expect(localStorage.getItem('fitfinder:auto-remove-bg')).toBe('off');
    pipeline.removeImageBackground.mockClear();
    choose([photo()]);
    await screen.findByText('Add 2 items');
    expect(pipeline.removeImageBackground).not.toHaveBeenCalled();
  });

  it('says when a new item looks like one already in the closet', async () => {
    closetRows.rows = [{ id: 'old', type: 'T-Shirt', colors: ['red'] }];
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    expect((await screen.findByRole('note')).textContent).toContain('Looks like your Red T-Shirt');
  });

  it('starts with photos dropped or pasted on the Closet screen', async () => {
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} initialFiles={[photo()]} />);
    expect(await screen.findByRole('button', { name: 'Type: T-Shirt. Edit' })).toBeTruthy();
  });

  it('reports the ids of what it added, so the closet can highlight them', async () => {
    const onItemsAdded = vi.fn();
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} onItemsAdded={onItemsAdded} />);
    choose([photo()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to closet' }));
    await waitFor(() => expect(onItemsAdded).toHaveBeenCalledWith(['new-item']));
    expect(pipeline.uploadItem).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'T-Shirt', colors: ['red'] }),
    );
  });

  it("doesn't let a late detection overwrite what the user chose", async () => {
    // Background removal re-runs detection; by then the user picked blue.
    let secondDetection: (v: unknown) => void = () => {};
    pipeline.detectItem
      .mockResolvedValueOnce({
        suggestedType: 'T-Shirt',
        suggestedSection: 'Tops',
        suggestedColors: ['red'],
      })
      .mockReturnValueOnce(new Promise((r) => (secondDetection = r)));
    renderWithProviders(<ImageUpload isOpen onClose={vi.fn()} />);
    choose([photo()]);
    fireEvent.click(await screen.findByRole('button', { name: 'Main color: Red. Edit' }));
    fireEvent.click(
      screen.getByRole('group', { name: 'Main color' }).querySelector('[aria-label="Blue"]')!,
    );
    secondDetection({
      suggestedType: 'T-Shirt',
      suggestedSection: 'Tops',
      suggestedColors: ['green'],
    });
    await waitFor(() => expect(pipeline.detectItem).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('button', { name: 'Main color: Blue. Edit' })).toBeTruthy();
  });
});
