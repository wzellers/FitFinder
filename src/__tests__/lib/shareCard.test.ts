import { describe, it, expect, vi, afterEach } from 'vitest';
import { CARD_HEIGHT, CARD_WIDTH, shareCardLayout, shareOrDownload } from '@/lib/shareCard';

describe('shareCardLayout', () => {
  const layout = shareCardLayout();

  it('stacks three equal squares, centred, top to bottom', () => {
    expect(layout.tiles).toHaveLength(3);
    for (const t of layout.tiles) {
      expect(t.w).toBe(t.h);
      expect(t.w).toBe(layout.tiles[0].w);
      expect(Math.abs(t.x + t.w / 2 - CARD_WIDTH / 2)).toBeLessThanOrEqual(1);
    }
    expect(layout.tiles[1].y).toBeGreaterThan(layout.tiles[0].y + layout.tiles[0].h);
    expect(layout.tiles[2].y).toBeGreaterThan(layout.tiles[1].y + layout.tiles[1].h);
  });

  it('keeps everything on the card, title above and palette and footer below', () => {
    const last = layout.tiles[2];
    expect(layout.titleY).toBeLessThan(layout.tiles[0].y);
    expect(layout.palette.y).toBeGreaterThan(last.y + last.h);
    expect(layout.footerY).toBeGreaterThan(layout.palette.y + layout.palette.h);
    expect(layout.footerY).toBeLessThanOrEqual(CARD_HEIGHT);
  });
});

describe('shareOrDownload', () => {
  const blob = new Blob(['png'], { type: 'image/png' });
  const nav = navigator as unknown as { share?: unknown; canShare?: unknown };

  afterEach(() => {
    delete nav.share;
    delete nav.canShare;
    vi.restoreAllMocks();
  });

  it('opens the share sheet where files can be shared', async () => {
    nav.share = vi.fn(() => Promise.resolve());
    nav.canShare = vi.fn(() => true);
    expect(await shareOrDownload(blob, 'fit.png')).toBe('shared');
    expect(nav.share).toHaveBeenCalledWith(expect.objectContaining({ files: [expect.any(File)] }));
  });

  it('downloads the image otherwise', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    expect(await shareOrDownload(blob, 'fit.png')).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('fit.png');
  });
});
