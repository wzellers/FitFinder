import { NextRequest, NextResponse } from 'next/server';
import { getRequestUserId } from '@/lib/serverAuth';
import { fetchWeatherFromProvider } from '@/lib/weatherProvider';

export async function POST(req: NextRequest) {
  // NEXT_PUBLIC_OPENWEATHERMAP_API_KEY is still read as a fallback until the
  // variable is renamed in Vercel. Reading it here (server-only) does not put
  // it in the browser bundle.
  const apiKey =
    process.env.OPENWEATHERMAP_API_KEY ?? process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Weather is not configured' }, { status: 503 });
  }

  const userId = await getRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const zip = typeof body?.zip === 'string' ? body.zip.trim() : '';
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ error: 'Enter a 5-digit US ZIP code' }, { status: 400 });
  }

  const weather = await fetchWeatherFromProvider(zip, apiKey);
  if (!weather) {
    return NextResponse.json({ error: 'Weather unavailable' }, { status: 502 });
  }
  return NextResponse.json(weather);
}
