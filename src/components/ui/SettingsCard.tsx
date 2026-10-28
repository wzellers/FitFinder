'use client';

import React, { useId } from 'react';

interface SettingsCardProps {
  icon?: React.ElementType;
  title: string;
  /** One line on what this setting does. */
  description?: React.ReactNode;
  children: React.ReactNode;
  /** Buttons along the bottom (e.g. Save, Reset). */
  actions?: React.ReactNode;
}

/**
 * The one card style for settings and similar panels: an icon, a title, a
 * line of explanation, the controls, then any actions along the bottom.
 */
export default function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  actions,
}: SettingsCardProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="card p-5 sm:p-6">
      <header className="flex items-start gap-3 mb-5">
        {Icon && (
          <span className="w-9 h-9 rounded-full bg-[var(--accent-light)] text-[var(--accent)] flex items-center justify-center shrink-0">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h3 id={id} className="text-base font-semibold">
            {title}
          </h3>
          {description && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{description}</p>
          )}
        </div>
      </header>
      {children}
      {actions && <div className="divider flex flex-wrap gap-2 mt-6 pt-4">{actions}</div>}
    </section>
  );
}
