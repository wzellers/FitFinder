import type { ClothingItem } from '@/lib/types';

let _idCounter = 1;

function nextId(): string {
  return `item-${_idCounter++}`;
}

export function makeItem(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return {
    id: nextId(),
    type: 'T-Shirt',
    colors: ['blue'],
    image_url: 'https://example.com/item.jpg',
    is_dirty: false,
    ...overrides,
  };
}

export function makeTop(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return makeItem({ type: 'T-Shirt', ...overrides });
}

export function makeBottom(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return makeItem({ type: 'Jeans', colors: ['navy blue'], ...overrides });
}

export function makeOuterwear(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return makeItem({ type: 'Jacket', colors: ['black'], ...overrides });
}

export function makeShoes(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return makeItem({ type: 'Shoes', colors: ['white'], ...overrides });
}

export function makeLayer(overrides: Partial<ClothingItem> = {}): ClothingItem {
  return makeItem({ type: 'Long Sleeve Shirt', colors: ['gray'], ...overrides });
}
