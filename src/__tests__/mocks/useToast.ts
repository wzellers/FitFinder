import { vi } from 'vitest';

export const mockShowToast = vi.fn();

export const mockUseToast = {
  showToast: mockShowToast,
};
