import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ToastProvider, { useToast } from '@/components/ToastProvider';
import React from 'react';

function TestComponent({ onMount }: { onMount: (showToast: ReturnType<typeof useToast>['showToast']) => void }) {
  const { showToast } = useToast();
  React.useEffect(() => {
    onMount(showToast);
  }, [onMount, showToast]);
  return <div data-testid="inner">children</div>;
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <div>Hello</div>
      </ToastProvider>,
    );
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('displays a toast message', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Test message'); });
    expect(screen.getByText('Test message')).toBeTruthy();
  });

  it('applies success color class', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Success!', 'success'); });
    const toast = screen.getByText('Success!');
    expect(toast.className).toContain('bg-green-600');
  });

  it('applies error color class', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Error!', 'error'); });
    const toast = screen.getByText('Error!');
    expect(toast.className).toContain('bg-red-600');
  });

  it('applies warning color class', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Warning!', 'warning'); });
    const toast = screen.getByText('Warning!');
    expect(toast.className).toContain('bg-amber-500');
  });

  it('dismisses toast on click', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Click me', 'info', 0); });
    const toast = screen.getByText('Click me');
    fireEvent.click(toast);
    expect(screen.queryByText('Click me')).toBeNull();
  });

  it('auto-dismisses after duration', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => { show('Auto dismiss', 'info', 1000); });
    expect(screen.getByText('Auto dismiss')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByText('Auto dismiss')).toBeNull();
  });

  it('stacks multiple toasts', () => {
    let show: ReturnType<typeof useToast>['showToast'];
    render(
      <ToastProvider>
        <TestComponent onMount={(fn) => { show = fn; }} />
      </ToastProvider>,
    );
    act(() => {
      show('First toast', 'info', 0);
      show('Second toast', 'info', 0);
    });
    expect(screen.getByText('First toast')).toBeTruthy();
    expect(screen.getByText('Second toast')).toBeTruthy();
  });

  it('throws when useToast used outside provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      render(<TestComponent onMount={vi.fn()} />);
    }).toThrow('useToast must be used within ToastProvider');
    spy.mockRestore();
  });
});
