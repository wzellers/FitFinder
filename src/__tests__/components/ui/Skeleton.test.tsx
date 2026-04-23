import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Skeleton,
  SkeletonGrid,
  SkeletonOutfitSlots,
  SkeletonStatCards,
  SkeletonCalendar,
  SkeletonFullScreen,
} from '@/components/ui/Skeleton';

function countPulsing(container: HTMLElement): number {
  return container.querySelectorAll('.animate-pulse').length;
}

describe('Skeleton', () => {
  it('renders a single animate-pulse element', () => {
    const { container } = render(<Skeleton />);
    expect(countPulsing(container)).toBe(1);
  });

  it('applies custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const el = container.firstElementChild;
    expect(el?.className).toContain('h-4');
    expect(el?.className).toContain('w-32');
  });
});

describe('SkeletonGrid', () => {
  it('renders 8 cards by default', () => {
    const { container } = render(<SkeletonGrid />);
    // Each card has 2 skeleton elements = 16 animate-pulse elements
    expect(countPulsing(container)).toBe(16);
  });

  it('respects custom count', () => {
    const { container } = render(<SkeletonGrid count={4} />);
    expect(countPulsing(container)).toBe(8);
  });
});

describe('SkeletonOutfitSlots', () => {
  it('renders 4 slot groups with 2 skeleton elements each', () => {
    const { container } = render(<SkeletonOutfitSlots />);
    expect(countPulsing(container)).toBe(8);
  });
});

describe('SkeletonStatCards', () => {
  it('renders 6 stat card groups', () => {
    const { container } = render(<SkeletonStatCards />);
    // Each card has 3 skeleton elements = 18 total
    expect(countPulsing(container)).toBe(18);
  });
});

describe('SkeletonCalendar', () => {
  it('renders calendar skeleton structure', () => {
    const { container } = render(<SkeletonCalendar />);
    // Should render many animate-pulse elements
    expect(countPulsing(container)).toBeGreaterThan(40);
  });
});

describe('SkeletonFullScreen', () => {
  it('renders 3 skeleton elements', () => {
    const { container } = render(<SkeletonFullScreen />);
    expect(countPulsing(container)).toBe(3);
  });
});
