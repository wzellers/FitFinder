// Send the daily email to everyone who is due. Called every 15 minutes by a
// Supabase pg_cron job (migration 018), authorized by a shared secret.
//
// Runs with the Supabase service-role key, so it must stay server-only and
// reject any caller without CRON_SECRET.

import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendDueEmails } from '@/lib/dailyEmail/sender';
import { RESEND_TEST_FROM, resendSender } from '@/lib/dailyEmail/resend';
import { fetchDailyForecast } from '@/lib/weatherProvider';

// A run signs image URLs and sends one email per due user; leave headroom.
export const maxDuration = 60;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  if (!secret || !supabaseUrl || !serviceRoleKey || !resendKey) {
    return NextResponse.json({ error: 'Daily email is not configured' }, { status: 500 });
  }
  if (!authorized(req, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const weatherKey =
    process.env.OPENWEATHERMAP_API_KEY ?? process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const summary = await sendDueEmails({
      db,
      appUrl: (process.env.APP_URL || req.nextUrl.origin).replace(/\/+$/, ''),
      fetchForecast: (zip) =>
        weatherKey ? fetchDailyForecast(zip, weatherKey) : Promise.resolve(null),
      sendEmail: resendSender(resendKey, process.env.EMAIL_FROM || RESEND_TEST_FROM),
      log: (message, detail) => console.log(JSON.stringify({ message, ...detail })),
    });
    return NextResponse.json(summary);
  } catch (err) {
    console.error('Daily email run failed:', err);
    return NextResponse.json({ error: 'Run failed' }, { status: 500 });
  }
}
