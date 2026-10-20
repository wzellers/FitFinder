// Send the daily email to every opted-in user who is due.
//
// Runs server-side with the Supabase service-role key (the route at
// /api/email/send-due wires in Resend). Dependencies are passed in so the
// whole run can be tested without an email provider or a database.

import type { SupabaseClient } from '@supabase/supabase-js';
import { buildDigest } from '@/lib/dailyEmail/digest';
import type { DailyForecast } from '@/lib/dailyEmail/digest';
import { renderDailyEmail } from '@/lib/dailyEmail/render';
import { isDue, shiftDate } from '@/lib/dailyEmail/schedule';
import { CLOTHING_BUCKET, imagePathFromUrl } from '@/lib/clothingImages';
import { throwIfAnyError } from '@/lib/supabaseResult';
import type { ClothingItem, OutfitWear } from '@/lib/types';

/** Image links in the email stay valid this long. */
const IMAGE_URL_TTL_S = 7 * 24 * 60 * 60;

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
}

export interface SenderDeps {
  /** Supabase client created with the service-role key. */
  db: SupabaseClient;
  sendEmail: (email: OutgoingEmail) => Promise<void>;
  fetchForecast: (zipCode: string) => Promise<DailyForecast | null>;
  /** Public app URL, e.g. https://fitfinder.vercel.app (no trailing slash). */
  appUrl: string;
  now?: Date;
  log?: (message: string, detail?: Record<string, unknown>) => void;
}

export interface SendSummary {
  optedIn: number;
  due: number;
  sent: number;
  failed: number;
}

interface ProfileRow {
  id: string;
  zip_code: string | null;
  daily_email_time: string | null;
  timezone: string | null;
  daily_email_last_sent: string | null;
  email_unsubscribe_token: string;
}

function must<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

/** Claim today's send so overlapping runs can't email a user twice. */
async function claim(db: SupabaseClient, profile: ProfileRow, localDate: string) {
  let query = db
    .from('profiles')
    .update({ daily_email_last_sent: localDate })
    .eq('id', profile.id)
    .eq('daily_email_enabled', true);
  query = profile.daily_email_last_sent
    ? query.eq('daily_email_last_sent', profile.daily_email_last_sent)
    : query.is('daily_email_last_sent', null);
  const rows = must(await query.select('id'), 'claim');
  return (rows ?? []).length === 1;
}

async function sendOne(
  deps: SenderDeps,
  profile: ProfileRow,
  localDate: string,
  forecasts: Map<string, Promise<DailyForecast | null>>,
) {
  const { db } = deps;

  const { data: userData, error: userError } = await db.auth.admin.getUserById(profile.id);
  if (userError) throw new Error(`user: ${userError.message}`);
  const email = userData.user?.email;
  if (!email || !userData.user?.email_confirmed_at) return false;

  const since = shiftDate(localDate, -14);
  const [
    { data: items },
    { data: recentWears },
    { data: ratedOutfits },
    { data: colorPrefs },
    { data: weatherPrefs },
    { data: occasionPrefs },
    { data: model },
  ] = throwIfAnyError(
    await Promise.all([
      db.from('clothing_items').select('*').eq('user_id', profile.id),
      db.from('outfit_wears').select('*').eq('user_id', profile.id).gte('worn_date', since),
      db
        .from('outfit_wears')
        .select('*')
        .eq('user_id', profile.id)
        .not('rating', 'is', null)
        .order('worn_date', { ascending: false })
        .limit(100),
      db
        .from('color_preferences')
        .select('liked_combinations')
        .eq('user_id', profile.id)
        .maybeSingle(),
      db
        .from('weather_preferences')
        .select('thresholds, clothing_rules')
        .eq('user_id', profile.id)
        .maybeSingle(),
      db.from('occasion_preferences').select('rules').eq('user_id', profile.id).maybeSingle(),
      db
        .from('outfit_model_weights')
        .select('weights, feature_meta')
        .eq('user_id', profile.id)
        .maybeSingle(),
    ]),
  );

  let forecast: DailyForecast | null = null;
  if (profile.zip_code) {
    if (!forecasts.has(profile.zip_code)) {
      forecasts.set(profile.zip_code, deps.fetchForecast(profile.zip_code));
    }
    forecast = await forecasts.get(profile.zip_code)!;
  }

  const closet = (items ?? []) as ClothingItem[];
  const digest = buildDigest({
    items: closet,
    recentWears: (recentWears ?? []) as OutfitWear[],
    ratedOutfits: (ratedOutfits ?? []) as OutfitWear[],
    likedCombinations: colorPrefs?.liked_combinations ?? [],
    model,
    forecast,
    thresholds: weatherPrefs?.thresholds ?? null,
    weatherRules: weatherPrefs?.clothing_rules ?? null,
    occasionRules: occasionPrefs?.rules ?? null,
    today: localDate,
  });

  // Sign every image the email shows, in one request.
  const shown = [
    ...(digest.outfit ? [digest.outfit.top, digest.outfit.bottom, digest.outfit.shoes] : []),
    ...digest.unworn,
  ];
  const pathById = new Map<string, string>();
  for (const item of shown) {
    const path = imagePathFromUrl(item.image_url);
    if (path) pathById.set(item.id, path);
  }
  const imageUrls: Record<string, string> = {};
  if (pathById.size > 0) {
    const paths = [...new Set(pathById.values())];
    const { data: signed } = await db.storage
      .from(CLOTHING_BUCKET)
      .createSignedUrls(paths, IMAGE_URL_TTL_S);
    const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    for (const [id, path] of pathById) {
      const url = urlByPath.get(path);
      if (url) imageUrls[id] = url;
    }
  }

  const unsubscribeUrl = `${deps.appUrl}/api/email/unsubscribe?token=${profile.email_unsubscribe_token}`;
  const rendered = renderDailyEmail({
    digest,
    forecast,
    date: localDate,
    imageUrls,
    appUrl: deps.appUrl,
    unsubscribeUrl,
  });

  if (!(await claim(db, profile, localDate))) return false;
  try {
    await deps.sendEmail({
      to: email,
      ...rendered,
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
  } catch (err) {
    // Release the claim so the next run retries within the catch-up window.
    await db
      .from('profiles')
      .update({ daily_email_last_sent: profile.daily_email_last_sent })
      .eq('id', profile.id);
    throw err;
  }
  return true;
}

export async function sendDueEmails(deps: SenderDeps): Promise<SendSummary> {
  const now = deps.now ?? new Date();
  const log = deps.log ?? (() => {});

  const profiles = must(
    await deps.db
      .from('profiles')
      .select(
        'id, zip_code, daily_email_time, timezone, daily_email_last_sent, email_unsubscribe_token',
      )
      .eq('daily_email_enabled', true),
    'profiles',
  ) as ProfileRow[] | null;

  const due = (profiles ?? [])
    .map((p) => ({
      profile: p,
      ...isDue({
        now,
        timeZone: p.timezone,
        sendTime: p.daily_email_time,
        lastSentDate: p.daily_email_last_sent,
      }),
    }))
    .filter((d) => d.due);

  const summary: SendSummary = {
    optedIn: profiles?.length ?? 0,
    due: due.length,
    sent: 0,
    failed: 0,
  };
  const forecasts = new Map<string, Promise<DailyForecast | null>>();

  // One at a time: a handful of users, and it stays under Resend's rate limit.
  for (const { profile, localDate } of due) {
    try {
      if (await sendOne(deps, profile, localDate, forecasts)) summary.sent++;
    } catch (err) {
      summary.failed++;
      // Log the user id only, never the address.
      log('daily email failed', {
        userId: profile.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  log('daily email run', { ...summary });
  return summary;
}
