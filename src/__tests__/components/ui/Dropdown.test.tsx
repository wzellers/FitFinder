import React, { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Dropdown, { type DropdownOption } from '@/components/ui/Dropdown';

const options: DropdownOption[] = [
  { value: '', label: 'All colors' },
  { value: 'red', label: 'Red', swatch: '#c0392b' },
  { value: 'navy blue', label: 'Navy Blue', swatch: '#1f2a4a' },
  { value: 'white', label: 'White', swatch: '#fafaf7' },
];

function Harness() {
  const [value, setValue] = useState('');
  return (
    <>
      <Dropdown label="Color" value={value} options={options} onChange={setValue} />
      <p data-testid="value">{value || 'none'}</p>
      <button>Elsewhere</button>
    </>
  );
}

const trigger = () => screen.getByRole('button', { name: /^Color: / });

describe('Dropdown', () => {
  it('opens a list and picks with a click', () => {
    render(<Harness />);
    expect(trigger().getAttribute('aria-label')).toBe('Color: All colors');
    fireEvent.click(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Navy Blue' }));
    expect(screen.getByTestId('value').textContent).toBe('navy blue');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger().getAttribute('aria-label')).toBe('Color: Navy Blue');
  });

  it('marks the chosen option and highlights the button while filtering', () => {
    render(<Harness />);
    expect(trigger().className).not.toContain('accent-light');
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('option', { name: 'Red' }));
    expect(trigger().className).toContain('accent-light');
    fireEvent.click(trigger());
    expect(screen.getByRole('option', { name: 'Red' }).getAttribute('aria-selected')).toBe('true');
  });

  it('works with the keyboard', () => {
    render(<Harness />);
    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    const list = screen.getByRole('listbox', { name: 'Color' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(screen.getByTestId('value').textContent).toBe('navy blue');

    fireEvent.keyDown(trigger(), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'w' });
    fireEvent.keyDown(screen.getByRole('listbox'), { key: ' ' });
    expect(screen.getByTestId('value').textContent).toBe('white');
  });

  it('closes with Escape or a click outside, without changing the value', () => {
    render(<Harness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.click(trigger());
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByTestId('value').textContent).toBe('none');
  });
});
