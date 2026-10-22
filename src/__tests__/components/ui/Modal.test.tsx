import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '@/components/ui/Modal';

describe('Modal', () => {
  it('renders an accessible dialog and focuses it', () => {
    render(
      <Modal label="Edit item" onClose={vi.fn()}>
        <button>Inside</button>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit item' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(dialog);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(
      <Modal label="x" onClose={onClose}>
        <button>Inside</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when not dismissible', () => {
    const onClose = vi.fn();
    render(
      <Modal label="x" onClose={onClose} dismissible={false}>
        <button>Inside</button>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('only the innermost modal reacts to Escape', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <Modal label="outer" onClose={outer}>
        <Modal label="inner" onClose={inner}>
          <button>Inside</button>
        </Modal>
      </Modal>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  it('returns focus to the trigger when closed', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          {open && (
            <Modal label="x" onClose={() => setOpen(false)}>
              <button>Inside</button>
            </Modal>
          )}
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByText('Open');
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
