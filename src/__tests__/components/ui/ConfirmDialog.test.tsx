import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ConfirmDialog from '@/components/ui/ConfirmDialog';

describe('ConfirmDialog', () => {
  it('does not render when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByText('Are you sure?')).toBeNull();
  });

  it('renders message when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Delete this item?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Delete this item?')).toBeTruthy();
  });

  it('renders default confirm and cancel labels', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Confirm')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders custom labels', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Are you sure?"
        confirmLabel="Yes, delete"
        cancelLabel="Never mind"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText('Yes, delete')).toBeTruthy();
    expect(screen.getByText('Never mind')).toBeTruthy();
  });

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        message="Confirm?"
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        message="Confirm?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when overlay is clicked', () => {
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        isOpen={true}
        message="Confirm?"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );
    // Click the overlay (first div = modal-overlay)
    const overlay = screen.getByText('Confirm?').closest('.modal-overlay') ?? document.querySelector('.modal-overlay');
    if (overlay) fireEvent.click(overlay);
    expect(onCancel).toHaveBeenCalled();
  });

  it('applies btn-danger class for danger variant (default)', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Delete?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('btn-danger');
  });

  it('applies btn-primary class for primary variant', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        message="Proceed?"
        variant="primary"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const confirmBtn = screen.getByText('Confirm');
    expect(confirmBtn.className).toContain('btn-primary');
  });
});
