// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { AnthropicBedrockMantle } from '@anthropic-ai/bedrock-sdk';
import Anthropic from '@anthropic-ai/sdk';
import { getVisionClient } from '@/lib/claudeClient';

describe('getVisionClient', () => {
  it('uses the direct Anthropic API when only ANTHROPIC_API_KEY is set', () => {
    const v = getVisionClient({ ANTHROPIC_API_KEY: 'test-key' });
    expect(v?.provider).toBe('anthropic');
    expect(v?.model).toBe('claude-haiku-4-5-20251001');
    expect(v?.client).toBeInstanceOf(Anthropic);
  });

  it('uses Amazon Bedrock with the Bedrock Haiku model id when selected', () => {
    const v = getVisionClient({
      CLAUDE_PROVIDER: 'bedrock',
      BEDROCK_AWS_REGION: 'us-east-1',
      BEDROCK_AWS_ACCESS_KEY_ID: 'AKIAEXAMPLE',
      BEDROCK_AWS_SECRET_ACCESS_KEY: 'secret',
      ANTHROPIC_API_KEY: 'ignored-when-bedrock',
    });
    expect(v?.provider).toBe('bedrock');
    expect(v?.model).toBe('anthropic.claude-haiku-4-5');
    expect(v?.client).toBeInstanceOf(AnthropicBedrockMantle);
    expect((v?.client as AnthropicBedrockMantle).awsRegion).toBe('us-east-1');
    expect((v?.client as AnthropicBedrockMantle).awsAccessKey).toBe('AKIAEXAMPLE');
  });

  it('lets the Bedrock model id be overridden', () => {
    const v = getVisionClient({
      CLAUDE_PROVIDER: 'bedrock',
      BEDROCK_AWS_REGION: 'us-west-2',
      BEDROCK_MODEL_ID: 'anthropic.claude-sonnet-5-5',
    });
    expect(v?.model).toBe('anthropic.claude-sonnet-5-5');
  });

  it('returns null when Bedrock is selected without a region', () => {
    expect(getVisionClient({ CLAUDE_PROVIDER: 'bedrock' })).toBeNull();
  });

  it('returns null when nothing is configured', () => {
    expect(getVisionClient({})).toBeNull();
  });
});
