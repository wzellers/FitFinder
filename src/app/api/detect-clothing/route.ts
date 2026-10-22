import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { clothingTypes, colorPalette } from '@/lib/constants';
import { getRequestUserId } from '@/lib/serverAuth';

const VALID_TYPES = Object.values(clothingTypes).flat();
const VALID_COLORS = [...colorPalette];

// The client sends a JPEG scaled to 1024px (well under 1 MB). Anything much
// larger is not from the app; refuse it before it reaches Claude.
const MAX_IMAGE_CHARS = 3 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });
  }

  // Only signed-in users may spend the Anthropic key.
  const userId = await getRequestUserId(req);
  if (!userId) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
  }

  try {
    const { image } = await req.json();
    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }
    if (image.length > MAX_IMAGE_CHARS) {
      return NextResponse.json({ error: 'Image too large' }, { status: 413 });
    }

    // image should be a base64 data URL like "data:image/png;base64,..."
    const base64Match = image.match(/^data:image\/(png|jpeg|gif|webp);base64,(.+)$/);
    if (!base64Match) {
      return NextResponse.json({ error: 'Invalid image format' }, { status: 400 });
    }

    const mediaType = `image/${base64Match[1]}` as
      'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    const base64Data = base64Match[2];

    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: base64Data },
            },
            {
              type: 'text',
              text: `Identify this clothing item. Respond with ONLY a JSON object, no other text:
{"type": "<one of: ${VALID_TYPES.join(', ')}>", "color": "<one of: ${VALID_COLORS.join(', ')}>", "secondaryColor": "<one of: ${VALID_COLORS.join(', ')} or null>"}

Pick the single best match for type and the dominant color. For secondaryColor, give a clearly present second color if the item has one, otherwise null. If unsure, make your best guess.`,
            },
          ],
        },
      ],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[^}]+\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse response' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const detectedType = VALID_TYPES.includes(parsed.type) ? parsed.type : null;
    const detectedColor = VALID_COLORS.includes(parsed.color) ? parsed.color : null;
    const detectedSecondary =
      VALID_COLORS.includes(parsed.secondaryColor) && parsed.secondaryColor !== detectedColor
        ? parsed.secondaryColor
        : null;

    return NextResponse.json({
      type: detectedType,
      color: detectedColor,
      secondaryColor: detectedSecondary,
    });
  } catch (err) {
    console.error('Clothing detection error:', err);
    return NextResponse.json({ error: 'Detection failed' }, { status: 500 });
  }
}
