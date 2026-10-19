# FitFinder daily email (AWS)

A CDK app that sends each opted-in user a morning email with an outfit picked
for the day's forecast and the clean items they haven't worn this week.

```
EventBridge Scheduler ── rate(15 min) ──▶ Lambda (Node 22, arm64, 1 at a time)
                                            ├─ Secrets Manager: service-role + weather keys
                                            ├─ Supabase: opted-in profiles, wardrobe, wears
                                            ├─ OpenWeatherMap: today's forecast per ZIP
                                            └─ SES: send the email
```

The sending logic lives in the app (`src/lib/dailyEmail/`). This package only
wires it to AWS: [`lambda/dailyEmail.ts`](lambda/dailyEmail.ts) is the handler,
and [`lib/dailyEmailStack.ts`](lib/dailyEmailStack.ts) is the stack.

Each run emails every user whose local send time (Settings → Email) has
passed today and who hasn't had today's email. A run that is late by more than
two hours skips that day rather than sending a stale email. Before sending,
the Lambda claims the day in `profiles.daily_email_last_sent`, so overlapping
runs can't double-send. If the send fails, it releases the claim and the next
run retries.

## Prerequisites

- Migration [`017_daily_email.sql`](../supabase/migrations/017_daily_email.sql)
  is applied to the Supabase project. Until it is, the Settings → Email tab
  says the feature isn't available yet.
- The AWS CLI v2 and Node 22.
- An **admin** AWS profile, for example through IAM Identity Center (SSO):
  `aws configure sso`, then `aws sso login --profile <name>`. In the
  commands below, `export AWS_PROFILE=<name>` first (or add `--profile`).
  Use the same region throughout, for example `export AWS_REGION=us-east-1`.

## Deploy

1. **Install the dependencies** (this package has its own `package.json`):

   ```bash
   cd infra && npm ci
   ```

2. **Create the secret.** It holds JSON with `SUPABASE_SERVICE_ROLE_KEY` (from
   Supabase → Project Settings → API keys) and `OPENWEATHERMAP_API_KEY`. The
   values go into Secrets Manager directly, never into CloudFormation or the
   Lambda's environment. To keep them out of your shell history, write them to
   a temporary file in an editor and pass the file in:

   ```bash
   umask 077 && $EDITOR /tmp/fitfinder-secret.json
   # {"SUPABASE_SERVICE_ROLE_KEY":"...","OPENWEATHERMAP_API_KEY":"..."}
   aws secretsmanager create-secret --name fitfinder/daily-email \
     --secret-string file:///tmp/fitfinder-secret.json
   rm /tmp/fitfinder-secret.json
   ```

   To change a value later, use `aws secretsmanager put-secret-value` with the
   same `--secret-string file://...` approach. Running Lambdas pick up the new
   value when their container is next replaced. To force that sooner, redeploy.

3. **Fill in [`cdk.json`](cdk.json)** context:

   | Key           | Example                               |
   | ------------- | ------------------------------------- |
   | `fromAddress` | `you@example.com`. SES verifies it.   |
   | `appUrl`      | `https://fitfinder.vercel.app`        |
   | `supabaseUrl` | `https://<project-ref>.supabase.co`   |
   | `secretName`  | `fitfinder/daily-email` (the default) |

   You can also pass them on the command line with `-c key=value`.

4. **Bootstrap** (once per account and region), then **deploy**:

   ```bash
   npx cdk bootstrap
   npx cdk deploy
   ```

   `npx cdk diff` shows what a deploy would change.

5. **Verify the sender.** SES emails `fromAddress` a verification link. Click
   it. Emails fail until you do.

## SES sandbox

New SES accounts are in the sandbox:

- Mail only goes to **verified** addresses. While the sender is also the only
  recipient, the step above covers it. To add another recipient, verify it in
  the SES console under Identities.
- At most **200 emails per 24 hours**, 1 per second.

To email other users, request production access in the SES console (Account
dashboard → Request production access).

## Test

- **Wait for the schedule.** In Settings → Email, turn the email on and set
  the time a few minutes ahead. It arrives on the first run after that time,
  within 15 minutes.
- **Or run it now:**

  ```bash
  aws lambda invoke --function-name "$(aws cloudformation describe-stacks \
    --stack-name FitFinderDailyEmail \
    --query "Stacks[0].Outputs[?OutputKey=='SenderFunctionName'].OutputValue" \
    --output text)" /dev/stdout
  ```

  The response is a summary: `{"optedIn":1,"due":1,"sent":1,"failed":0}`.

- **Send again the same day.** Only one email goes out per local day. To get
  another, clear the claim in the Supabase SQL editor:

  ```sql
  update profiles set daily_email_last_sent = null where id = '<your user id>';
  ```

- **Logs** are in CloudWatch, in the log group named by the stack's
  `SenderLogGroupName` output (kept for a month). They contain user ids only,
  never addresses. To follow them live:

  ```bash
  aws logs tail --follow "$(aws cloudformation describe-stacks \
    --stack-name FitFinderDailyEmail \
    --query "Stacks[0].Outputs[?OutputKey=='SenderLogGroupName'].OutputValue" \
    --output text)"
  ```

## Cost

About **$0.40 a month**, almost all of it for the Secrets Manager secret. The
Lambda (about 3,000 short runs a month), the scheduler, and SES at this volume
fall within the free tiers or round to zero.

## Tear down

```bash
npx cdk destroy
aws secretsmanager delete-secret --secret-id fitfinder/daily-email
```

`cdk destroy` doesn't remove the secret (the stack doesn't own it) or the
CDK bootstrap stack (`CDKToolkit`). By default, Secrets Manager deletes a
secret after 30 days. Users' email settings stay in Supabase, so redeploying
picks up where it left off.
