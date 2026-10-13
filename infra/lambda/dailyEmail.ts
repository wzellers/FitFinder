// Lambda entry point: wires AWS (Secrets Manager, SES) and Supabase into the
// app's daily email sender. Invoked every 15 minutes by EventBridge Scheduler.

import { createClient } from '@supabase/supabase-js';
import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { SendEmailCommand, SESv2Client } from '@aws-sdk/client-sesv2';
import { sendDueEmails } from '@/lib/dailyEmail/sender';
import type { SendSummary } from '@/lib/dailyEmail/sender';
import { fetchDailyForecast } from '@/lib/weatherProvider';

interface Secrets {
  SUPABASE_SERVICE_ROLE_KEY: string;
  OPENWEATHERMAP_API_KEY?: string;
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

const ses = new SESv2Client({});
const secretsManager = new SecretsManagerClient({});

// Cached for the life of the container.
let secrets: Promise<Secrets> | null = null;
function loadSecrets(): Promise<Secrets> {
  secrets ??= secretsManager
    .send(new GetSecretValueCommand({ SecretId: env('SECRET_ID') }))
    .then((res) => {
      const parsed = JSON.parse(res.SecretString ?? '{}') as Partial<Secrets>;
      if (!parsed.SUPABASE_SERVICE_ROLE_KEY) {
        throw new Error('The secret has no SUPABASE_SERVICE_ROLE_KEY');
      }
      return parsed as Secrets;
    })
    .catch((err) => {
      secrets = null;
      throw err;
    });
  return secrets;
}

export async function handler(): Promise<SendSummary> {
  const { SUPABASE_SERVICE_ROLE_KEY, OPENWEATHERMAP_API_KEY } = await loadSecrets();
  const db = createClient(env('SUPABASE_URL'), SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const from = env('FROM_ADDRESS');

  return sendDueEmails({
    db,
    appUrl: env('APP_URL'),
    fetchForecast: (zip) =>
      OPENWEATHERMAP_API_KEY
        ? fetchDailyForecast(zip, OPENWEATHERMAP_API_KEY)
        : Promise.resolve(null),
    sendEmail: async ({ to, subject, html, text, headers }) => {
      await ses.send(
        new SendEmailCommand({
          FromEmailAddress: `FitFinder <${from}>`,
          Destination: { ToAddresses: [to] },
          Content: {
            Simple: {
              Subject: { Data: subject, Charset: 'UTF-8' },
              Body: {
                Html: { Data: html, Charset: 'UTF-8' },
                Text: { Data: text, Charset: 'UTF-8' },
              },
              Headers: Object.entries(headers).map(([Name, Value]) => ({ Name, Value })),
            },
          },
        }),
      );
    },
    log: (message, detail) => console.log(JSON.stringify({ message, ...detail })),
  });
}
