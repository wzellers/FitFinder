import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendDueEmails } from '@/lib/dailyEmail/sender';
import type { OutgoingEmail } from '@/lib/dailyEmail/sender';
import { makeBottom, makeShoes, makeTop } from '../factories/clothingItem';

// 12:30 UTC is 08:30 in New York.
const NOW = new Date('2026-10-13T12:30:00Z');

interface Profile {
  id: string;
  zip_code: string | null;
  daily_email_time: string;
  timezone: string;
  daily_email_last_sent: string | null;
  email_unsubscribe_token: string;
}

const profile = (id: string, overrides: Partial<Profile> = {}): Profile => ({
  id,
  zip_code: '10001',
  daily_email_time: '08:00:00',
  timezone: 'America/New_York',
  daily_email_last_sent: null,
  email_unsubscribe_token: `token-${id}`,
  ...overrides,
});

/**
 * A minimal stand-in for the service-role Supabase client: every query
 * builder method chains, and awaiting it returns rows for the table.
 */
function fakeDb(opts: {
  profiles: Profile[];
  closet?: Record<string, unknown[]>;
  /** Users whose claim loses to another run. */
  claimedElsewhere?: string[];
}) {
  const updates: { id: string; values: Record<string, unknown> }[] = [];
  const from = (table: string) => {
    const filters: Record<string, unknown> = {};
    let values: Record<string, unknown> | null = null;
    let returning = false;
    const result = () => {
      if (values) {
        const id = filters.id as string;
        updates.push({ id, values });
        const won = !opts.claimedElsewhere?.includes(id);
        return { data: returning ? (won ? [{ id }] : []) : null, error: null };
      }
      if (table === 'profiles') return { data: opts.profiles, error: null };
      const rows = opts.closet?.[`${table}:${filters.user_id}`] ?? [];
      return { data: rows, error: null };
    };
    const builder: Record<string, unknown> = {
      select: () => {
        if (values) returning = true;
        return builder;
      },
      update: (v: Record<string, unknown>) => {
        values = v;
        return builder;
      },
      eq: (col: string, val: unknown) => {
        filters[col] = val;
        return builder;
      },
      is: () => builder,
      gte: () => builder,
      not: () => builder,
      order: () => builder,
      limit: () => builder,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(result()).then(resolve),
    };
    return builder;
  };
  const db = {
    from,
    auth: {
      admin: {
        getUserById: async (id: string) => ({
          data: {
            user:
              id === 'unconfirmed'
                ? { email: 'x@example.com', email_confirmed_at: null }
                : { email: `${id}@example.com`, email_confirmed_at: '2026-01-01' },
          },
          error: null,
        }),
      },
    },
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
          error: null,
        }),
      }),
    },
  };
  return { db: db as unknown as SupabaseClient, updates };
}

const closetFor = (id: string) => ({
  [`clothing_items:${id}`]: [
    makeTop({ image_url: `${id}/top.png` }),
    makeBottom({ image_url: `${id}/bottom.png` }),
    makeShoes({ image_url: `${id}/shoes.png` }),
  ],
});

function run(db: SupabaseClient, sendEmail = vi.fn(async (_e: OutgoingEmail) => {})) {
  const fetchForecast = vi.fn(async () => ({
    high: 68,
    low: 52,
    rainChance: 0.1,
    condition: 'Clouds',
    description: 'broken clouds',
  }));
  const log = vi.fn();
  const summary = sendDueEmails({
    db,
    sendEmail,
    fetchForecast,
    appUrl: 'https://fitfinder.example',
    now: NOW,
    log,
  });
  return { summary, sendEmail, fetchForecast, log };
}

describe('sendDueEmails', () => {
  it('emails due users and records the local date', async () => {
    const { db, updates } = fakeDb({
      profiles: [
        profile('ny'),
        // 05:30 in Los Angeles: not yet.
        profile('la', { timezone: 'America/Los_Angeles' }),
        profile('done', { daily_email_last_sent: '2026-10-13' }),
      ],
      closet: closetFor('ny'),
    });
    const { summary, sendEmail } = run(db);
    expect(await summary).toEqual({ optedIn: 3, due: 1, sent: 1, failed: 0 });

    const email = sendEmail.mock.calls[0][0];
    expect(email.to).toBe('ny@example.com');
    expect(email.html).toContain('https://signed/ny/top.png');
    expect(email.headers['List-Unsubscribe']).toBe(
      '<https://fitfinder.example/api/email/unsubscribe?token=token-ny>',
    );
    expect(email.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    expect(updates).toEqual([{ id: 'ny', values: { daily_email_last_sent: '2026-10-13' } }]);
  });

  it('fetches each ZIP code once per run', async () => {
    const { db } = fakeDb({ profiles: [profile('a'), profile('b')] });
    const { summary, fetchForecast } = run(db);
    expect((await summary).sent).toBe(2);
    expect(fetchForecast).toHaveBeenCalledTimes(1);
  });

  it('skips users another run already claimed, and unconfirmed addresses', async () => {
    const { db } = fakeDb({
      profiles: [profile('a'), profile('unconfirmed')],
      claimedElsewhere: ['a'],
    });
    const { summary, sendEmail } = run(db);
    expect(await summary).toEqual({ optedIn: 2, due: 2, sent: 0, failed: 0 });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('releases the claim and carries on when a send fails', async () => {
    const { db, updates } = fakeDb({ profiles: [profile('a'), profile('b')] });
    const sendEmail = vi.fn(async (e: OutgoingEmail) => {
      if (e.to.startsWith('a@')) throw new Error('SES throttled');
    });
    const { summary, log } = run(db, sendEmail);
    expect(await summary).toEqual({ optedIn: 2, due: 2, sent: 1, failed: 1 });
    expect(updates).toContainEqual({ id: 'a', values: { daily_email_last_sent: null } });
    expect(log).toHaveBeenCalledWith('daily email failed', {
      userId: 'a',
      error: 'SES throttled',
    });
    // Addresses never reach the logs.
    expect(JSON.stringify(log.mock.calls)).not.toContain('@example.com');
  });
});
