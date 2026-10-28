'use client';

import React from 'react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  /** Accessible name of the close button (default "Close"). */
  closeLabel?: string;
  /** Icon for the close button (default an ×). */
  closeIcon?: React.ReactNode;
  /** Extra buttons beside the close button (e.g. Delete). */
  actions?: React.ReactNode;
}

/** The one header style for every dialog: title, optional line under it,
 * actions and a round close button. */
export default function ModalHeader({
  title,
  subtitle,
  onClose,
  closeLabel = 'Close',
  closeIcon,
  actions,
}: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-sm text-[var(--text-secondary)] mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="w-10 h-10 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            {closeIcon ?? <X size={18} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
}
