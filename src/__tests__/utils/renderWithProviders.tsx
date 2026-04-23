import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import ToastProvider from '@/components/ToastProvider';

function AllProviders({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  return render(ui, { wrapper: AllProviders, ...options });
}
