// Render the daily email as HTML and plain text.
//
// Email clients ignore stylesheets and most modern CSS, so the HTML uses
// tables and inline styles, coloured by the outfit it recommends (like the
// app) on the app's fog & slate neutrals.

import { describeItem } from '@/lib/itemLabels';
import { colorMap } from '@/lib/constants';
import { NEUTRAL_ACCENT, themeFromOutfit } from '@/lib/outfitTheme';
import type { ClothingItem } from '@/lib/types';
import type { DailyForecast, Digest } from '@/lib/dailyEmail/digest';
import { outfitLink } from '@/lib/outfitLink';

export interface RenderInput {
  digest: Digest;
  forecast: DailyForecast | null;
  /** The email's local date, `YYYY-MM-DD`. */
  date: string;
  /** Signed image URLs by item id. Items without one show a color swatch. */
  imageUrls: Record<string, string>;
  appUrl: string;
  unsubscribeUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** The app's fog & slate neutrals, shared by every email. */
const C = {
  text: '#1f2a33',
  secondary: '#56636e',
  muted: '#e9edf0',
  border: '#dde3e8',
};

/** The email's colours: from the recommended outfit (its top first, like the
 * app), or the fog & slate neutrals when there's no outfit. */
export interface EmailColors {
  /** Headings, the weather and the button. */
  accent: string;
  accentInk: string;
  /** Soft fill behind the weather. */
  tint: string;
  /** The banner behind "Today's fit", and its title. */
  bannerBg: string;
  bannerTitle: string;
  bannerFg: string;
}

const NEUTRAL: EmailColors = {
  accent: NEUTRAL_ACCENT,
  accentInk: '#ffffff',
  tint: '#e9ecef',
  bannerBg: '#dce3ea',
  bannerTitle: '#34495b',
  bannerFg: '#22313d',
};

export function emailColors(
  outfit: { top: ClothingItem; bottom: ClothingItem; shoes: ClothingItem } | null,
): EmailColors {
  const [top, bottom, shoes] = outfit ? [outfit.top, outfit.bottom, outfit.shoes] : [];
  if (!top?.colors[0] || !bottom?.colors[0]) return NEUTRAL;
  const t = themeFromOutfit(top.colors[0], bottom.colors[0], shoes?.colors[0]);
  return {
    accent: t.uiAccent,
    accentInk: t.uiAccentInk,
    tint: t.uiTint,
    bannerBg: t.posterBg,
    bannerTitle: t.posterTitle,
    bannerFg: t.posterFg,
  };
}

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, monospace";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** "Tuesday, October 13" for a `YYYY-MM-DD` date. */
function formatEmailDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`));
}

/** One line of weather, e.g. "High 64° · Low 48° · 70% chance of rain". */
export function forecastLine(forecast: DailyForecast): string {
  const parts = [`High ${forecast.high}°`, `Low ${forecast.low}°`];
  const rain = Math.round(forecast.rainChance * 100);
  if (rain >= 20) parts.push(`${rain}% chance of rain`);
  else parts.push(forecast.description || forecast.condition);
  return parts.join(' · ');
}

/** A short nudge for the day's weather, or null when there's nothing to add. */
export function weatherTip(forecast: DailyForecast): string | null {
  if (forecast.rainChance >= 0.5) return 'Rain is likely, so bring a jacket or an umbrella.';
  if (forecast.high - forecast.low >= 20)
    return 'Big swing between morning and afternoon. Layer up.';
  return null;
}

function itemCell(
  item: ClothingItem,
  label: string,
  imageUrls: Record<string, string>,
  size: number,
) {
  const url = imageUrls[item.id];
  const name = escapeHtml(describeItem(item));
  const swatch = colorMap[item.colors[0]] ?? C.muted;
  const visual = url
    ? `<img src="${escapeHtml(url)}" width="${size}" height="${size}" alt="${name}" style="display:block;width:${size}px;height:${size}px;object-fit:contain;background:${C.muted};border-radius:12px;border:0;">`
    : `<div role="img" aria-label="${name}" style="width:${size}px;height:${size}px;background:${swatch};border-radius:12px;"></div>`;
  return `<td valign="top" style="padding:6px;width:${size}px;">
  ${visual}
  ${label ? `<div style="font-family:${MONO};font-size:10px;letter-spacing:1px;text-transform:uppercase;color:${C.secondary};padding-top:8px;">${label}</div>` : ''}
  <div style="font-family:${FONT};font-size:13px;line-height:18px;color:${C.text};padding-top:2px;">${name}</div>
</td>`;
}

function row(cells: string[]) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${cells.join('')}</tr></table>`;
}

function heading(text: string, color: string) {
  return `<div style="font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${color};padding:28px 0 10px;">${text}</div>`;
}

export function renderDailyEmail(input: RenderInput): RenderedEmail {
  const { digest, forecast, date, imageUrls, appUrl, unsubscribeUrl } = input;
  const dateLabel = formatEmailDate(date);
  const tip = forecast ? weatherTip(forecast) : null;
  const weatherText = forecast ? forecastLine(forecast) : null;
  const P = emailColors(digest.outfit);

  const subject = digest.outfit
    ? `Today's fit: ${describeItem(digest.outfit.top)} + ${describeItem(digest.outfit.bottom)}${forecast ? ` · ${forecast.high}°` : ''}`
    : `Your FitFinder morning, ${dateLabel}`;

  // ---- HTML -------------------------------------------------------------
  const weatherBlock = forecast
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.tint};border-radius:14px;"><tr><td style="padding:16px 18px;">
  <div style="font-family:${FONT};font-size:28px;font-weight:700;color:${P.accent};">${forecast.high}° <span style="font-size:18px;font-weight:400;color:${C.secondary};">/ ${forecast.low}°</span></div>
  <div style="font-family:${FONT};font-size:14px;color:${C.text};padding-top:4px;">${escapeHtml(weatherText!)}</div>
  ${tip ? `<div style="font-family:${FONT};font-size:14px;color:${C.text};padding-top:8px;">${escapeHtml(tip)}</div>` : ''}
</td></tr></table>`
    : `<p style="font-family:${FONT};font-size:14px;color:${C.secondary};margin:0;">No forecast today. Add your ZIP code in Settings to dress for the weather.</p>`;

  const outfitBlock = digest.outfit
    ? row([
        itemCell(digest.outfit.top, 'Top', imageUrls, 160),
        itemCell(digest.outfit.bottom, 'Bottom', imageUrls, 160),
        itemCell(digest.outfit.shoes, 'Shoes', imageUrls, 160),
      ])
    : `<p style="font-family:${FONT};font-size:14px;color:${C.text};margin:0;">Nothing clean fits today's weather. Do a load of laundry, or add a few pieces to your closet.</p>`;

  // The button opens the Outfits screen with this outfit on it.
  const openUrl = digest.outfit ? outfitLink(appUrl, digest.outfit) : appUrl;

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f7;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;"><tr><td>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${P.bannerBg};border-radius:18px;margin-bottom:18px;"><tr><td style="padding:18px 20px;">
    <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${P.bannerFg};">FitFinder · ${escapeHtml(dateLabel)}</div>
    <div style="font-family:${FONT};font-size:30px;font-weight:800;color:${P.bannerTitle};padding-top:6px;">Today's fit</div>
  </td></tr></table>
  ${weatherBlock}
  ${heading('Wear this', P.accent)}
  ${outfitBlock}
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:28px;"><tr><td style="background:${P.accent};border-radius:999px;">
    <a href="${escapeHtml(openUrl)}" style="display:inline-block;padding:12px 22px;font-family:${FONT};font-size:14px;font-weight:700;color:${P.accentInk};text-decoration:none;">Open FitFinder</a>
  </td></tr></table>
  <p style="font-family:${FONT};font-size:12px;line-height:18px;color:${C.secondary};border-top:1px solid ${C.border};margin:32px 0 0;padding-top:14px;">
    You get this because you turned on the daily email in FitFinder Settings.
    <a href="${escapeHtml(unsubscribeUrl)}" style="color:${C.secondary};">Unsubscribe</a>
  </p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  // ---- Plain text -------------------------------------------------------
  const lines = [`FitFinder · ${dateLabel}`, ''];
  if (forecast) {
    lines.push(weatherText!);
    if (tip) lines.push(tip);
  } else {
    lines.push('No forecast today. Add your ZIP code in Settings to dress for the weather.');
  }
  lines.push('', 'WEAR THIS');
  if (digest.outfit) {
    lines.push(
      `Top: ${describeItem(digest.outfit.top)}`,
      `Bottom: ${describeItem(digest.outfit.bottom)}`,
      `Shoes: ${describeItem(digest.outfit.shoes)}`,
    );
  } else {
    lines.push("Nothing clean fits today's weather.");
  }
  lines.push('', `Open FitFinder: ${openUrl}`, `Unsubscribe: ${unsubscribeUrl}`);

  return { subject, html, text: lines.join('\n') };
}
