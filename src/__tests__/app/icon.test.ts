import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import { ICON_COLORS, contentType, size } from '@/app/apple-icon';

const svg = fs.readFileSync(path.resolve(__dirname, '../../app/icon.svg'), 'utf8');

describe('app icon', () => {
  it('is a well-formed, square SVG in the Fog & Slate colours', () => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.getAttribute('viewBox')).toBe('0 0 64 64');
    expect(svg).toContain(ICON_COLORS.slate);
    expect(svg).toContain(ICON_COLORS.fog);
  });

  it('draws the F on the tag (stem and two bars)', () => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const strokes = [...doc.querySelectorAll('g path')].map((p) => p.getAttribute('d'));
    expect(strokes).toEqual(['M28 27 V47', 'M28 27 H37', 'M28 36 H35']);
  });

  it('has a 180px PNG version for the Home Screen and Dock', () => {
    expect(size).toEqual({ width: 180, height: 180 });
    expect(contentType).toBe('image/png');
  });
});
