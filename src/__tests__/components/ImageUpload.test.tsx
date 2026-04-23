import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../utils/renderWithProviders';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({ user: { id: 'u1' } })),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({ data: { path: 'test/path.jpg' }, error: null })),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://storage.example.com/img.jpg' } })),
      })),
    },
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  },
}));

// Mock dynamic import for react-easy-crop
vi.mock('react-easy-crop', () => ({
  default: vi.fn(() => null),
}));

// Mock @imgly/background-removal dynamic import
vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn(() => Promise.resolve(new Blob([''], { type: 'image/png' }))),
}));

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: vi.fn(() => () => null),
}));

import ImageUpload from '@/components/ImageUpload';

describe('ImageUpload', () => {
  it('does not render when isOpen is false', () => {
    renderWithProviders(
      <ImageUpload isOpen={false} onClose={vi.fn()} />,
    );
    expect(screen.queryByText(/Upload/i)).toBeNull();
  });

  it('renders upload step when isOpen is true', () => {
    renderWithProviders(
      <ImageUpload isOpen={true} onClose={vi.fn()} />,
    );
    expect(screen.getByText(/Upload/i)).toBeTruthy();
  });

  it('shows file input for uploading', () => {
    renderWithProviders(
      <ImageUpload isOpen={true} onClose={vi.fn()} />,
    );
    // File input or upload area should be present
    const fileInput = document.querySelector('input[type="file"]');
    const uploadArea = screen.queryByText(/drag/i) ?? screen.queryByText(/click/i) ?? screen.queryAllByRole('button')[0];
    expect(fileInput ?? uploadArea).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <ImageUpload isOpen={true} onClose={onClose} />,
    );
    const closeBtn = document.querySelector('.btn-ghost');
    if (closeBtn) fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
