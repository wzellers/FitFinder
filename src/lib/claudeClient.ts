// Server-only: choose how the app reaches Claude.
//
// - Direct Anthropic API (default): set ANTHROPIC_API_KEY.
// - Amazon Bedrock: set CLAUDE_PROVIDER=bedrock and BEDROCK_AWS_REGION, plus
//   credentials. Vercel reserves the standard AWS_* names for its own use, so
//   keys are read from BEDROCK_AWS_ACCESS_KEY_ID / BEDROCK_AWS_SECRET_ACCESS_KEY
//   (an IAM user or role limited to `bedrock-mantle:CreateInference` on the
//   Haiku model). Without them the SDK falls back to the standard AWS
//   credential chain (env vars, ~/.aws, SSO, instance roles), which is handy
//   for local development.
//
// Both clients expose the same `messages.create` API, so callers don't change.

import Anthropic from '@anthropic-ai/sdk';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';

export type ClaudeProvider = 'anthropic' | 'bedrock';

export interface VisionClient {
  provider: ClaudeProvider;
  client: Pick<Anthropic, 'messages'>;
  /** Claude Haiku 4.5, in the id format the provider expects. */
  model: string;
}

const ANTHROPIC_HAIKU = 'claude-haiku-4-5-20251001';
const BEDROCK_HAIKU = 'anthropic.claude-haiku-4-5';

/**
 * The client for clothing detection, or null when neither provider is
 * configured (the route then reports that detection is unavailable).
 */
export function getVisionClient(
  env: Record<string, string | undefined> = process.env,
): VisionClient | null {
  if (env.CLAUDE_PROVIDER === 'bedrock') {
    const awsRegion = env.BEDROCK_AWS_REGION;
    if (!awsRegion) return null;
    const accessKey = env.BEDROCK_AWS_ACCESS_KEY_ID;
    const secretKey = env.BEDROCK_AWS_SECRET_ACCESS_KEY;
    return {
      provider: 'bedrock',
      client: new AnthropicBedrockMantle({
        awsRegion,
        // Explicit keys when set; otherwise the default AWS credential chain.
        ...(accessKey && secretKey
          ? {
              awsAccessKey: accessKey,
              awsSecretAccessKey: secretKey,
              awsSessionToken: env.BEDROCK_AWS_SESSION_TOKEN ?? null,
            }
          : {}),
      }),
      model: env.BEDROCK_MODEL_ID || BEDROCK_HAIKU,
    };
  }

  if (env.ANTHROPIC_API_KEY) {
    return {
      provider: 'anthropic',
      client: new Anthropic({ apiKey: env.ANTHROPIC_API_KEY }),
      model: ANTHROPIC_HAIKU,
    };
  }
  return null;
}
