import React from 'react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-[var(--muted)] rounded ${className}`} />
  );
}

export function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-2 space-y-2">
          <Skeleton className="aspect-square w-full rounded-lg" />
          <Skeleton className="h-3 w-2/3 mx-auto" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonOutfitSlots() {
  return (
    <div className="flex flex-col items-center gap-4 max-w-md mx-auto">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="w-44 h-44 sm:w-52 sm:h-52 rounded-xl" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card p-5 space-y-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCalendar() {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton className="h-8 w-8 rounded" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-8 w-8 rounded" />
      </div>
      <div className="grid grid-cols-7 gap-[2px] bg-[var(--muted)] rounded-xl overflow-hidden border border-[var(--border)]">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={`h-${i}`} className="h-8 rounded-none" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-white min-h-[120px] p-1.5">
            <Skeleton className="h-4 w-6 mb-2" />
            <div className="flex gap-0.5 mt-auto">
              <Skeleton className="w-10 h-10 rounded" />
              <Skeleton className="w-10 h-10 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonFullScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-2xl" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}
