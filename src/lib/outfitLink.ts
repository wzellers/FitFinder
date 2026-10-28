// A link that opens the Outfits screen with a given outfit on it, used by the
// daily email's "Open FitFinder" button.

export interface OutfitLinkIds {
  top_id: string;
  bottom_id: string;
  shoes_id: string;
}

/** `appUrl` with the outfit's piece ids in the query string. */
export function outfitLink(
  appUrl: string,
  outfit: { top: { id: string }; bottom: { id: string }; shoes: { id: string } },
): string {
  const params = new URLSearchParams({
    top: outfit.top.id,
    bottom: outfit.bottom.id,
    shoes: outfit.shoes.id,
  });
  return `${appUrl}/?${params}`;
}

/** The outfit in a link's query string, or null when it doesn't name one. */
export function parseOutfitLink(search: string): OutfitLinkIds | null {
  const params = new URLSearchParams(search);
  const top_id = params.get('top');
  const bottom_id = params.get('bottom');
  const shoes_id = params.get('shoes');
  if (!top_id || !bottom_id || !shoes_id) return null;
  return { top_id, bottom_id, shoes_id };
}
