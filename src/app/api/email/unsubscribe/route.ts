// Unsubscribe from the daily email without signing in.
//
// GET shows a confirmation button rather than unsubscribing, because mail
// scanners open links in emails. POST does the work, for both that button and
// one-click unsubscribe from mail apps (RFC 8058 List-Unsubscribe-Post).

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function page(title: string, body: string, status = 200) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title} · FitFinder</title></head>
<body style="margin:0;background:#f4f6f7;color:#1f2a33;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
<main style="max-width:440px;margin:0 auto;padding:64px 16px;">
<p style="font-family:Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#56636e;margin:0;">FitFinder</p>
<h1 style="font-size:28px;color:#4a6276;margin:8px 0 16px;">${title}</h1>
${body}
</main></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

const p = (text: string) =>
  `<p style="font-size:16px;line-height:24px;margin:0 0 16px;">${text}</p>`;

function invalid() {
  return page(
    'Link not recognized',
    p(
      'This unsubscribe link is incomplete. You can turn the daily email off in FitFinder Settings.',
    ),
    400,
  );
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!UUID.test(token)) return invalid();
  return page(
    'Stop the daily email?',
    `${p("You won't get the morning outfit email anymore. You can turn it back on in Settings.")}
<form method="post" action="?token=${token}">
<button type="submit" style="background:#4a6276;color:#ffffff;border:0;border-radius:999px;padding:12px 22px;font-size:15px;font-weight:700;cursor:pointer;">Unsubscribe</button>
</form>`,
  );
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!UUID.test(token)) return invalid();

  const { error } = await supabase.rpc('unsubscribe_daily_email', { token });
  if (error) {
    return page('Something went wrong', p("We couldn't unsubscribe you. Try the link again."), 500);
  }
  // Unknown tokens get the same answer, so the page reveals nothing.
  return page(
    "You're unsubscribed",
    p('No more daily emails. You can turn them back on any time in FitFinder Settings.'),
  );
}
