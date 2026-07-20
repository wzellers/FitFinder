#!/usr/bin/env node
/**
 * Vision pipeline latency + accuracy harness (measurement tool — NOT app code).
 *
 * Hits the REAL /api/detect-clothing endpoint with a folder of local clothing
 * photos and reports:
 *   - end-to-end latency (median / p95 / mean) of the classification round-trip
 *   - type accuracy and primary-color accuracy vs. hand-labeled ground truth
 *
 * These are honest, reproducible numbers: they come from actually calling Claude
 * (claude-haiku-4-5) through the app's own route on your own photos. Nothing is
 * simulated or invented.
 *
 * ---------------------------------------------------------------------------
 * SETUP
 * ---------------------------------------------------------------------------
 * 1. Start the dev server (needs ANTHROPIC_API_KEY set in your env / .env.local):
 *        npm run dev
 * 2. Put clothing photos (.png/.jpg/.jpeg/.webp) in a folder, e.g. ./bench-images/
 * 3. (Optional, for accuracy) create ./bench-images/labels.json mapping filename ->
 *    { "type": "...", "color": "..." } using the exact type/color strings the app
 *    uses (see src/lib/constants.ts). Files without a label are still timed for
 *    latency but skipped for accuracy. Example labels.json:
 *        {
 *          "shirt1.jpg": { "type": "T-Shirt", "color": "Blue" },
 *          "jeans.png":  { "type": "Jeans",   "color": "Blue" }
 *        }
 *
 * ---------------------------------------------------------------------------
 * RUN
 * ---------------------------------------------------------------------------
 *    node scripts/measureVision.mjs ./bench-images
 *    node scripts/measureVision.mjs ./bench-images http://localhost:3000
 */

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const IMAGE_DIR = process.argv[2] || './bench-images';
const BASE_URL = (process.argv[3] || 'http://localhost:3000').replace(/\/$/, '');
const ENDPOINT = `${BASE_URL}/api/detect-clothing`;

const EXT_TO_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

function pct(sorted, p) {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}
const median = (a) =>
  pct(
    [...a].sort((x, y) => x - y),
    50,
  );
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN);
const norm = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase();

async function main() {
  if (!existsSync(IMAGE_DIR)) {
    console.error(`Image dir not found: ${IMAGE_DIR}`);
    console.error('Create it, add photos, then re-run. See the header of this file.');
    process.exit(1);
  }

  // Load optional ground-truth labels.
  let labels = {};
  const labelsPath = path.join(IMAGE_DIR, 'labels.json');
  if (existsSync(labelsPath)) {
    labels = JSON.parse(await readFile(labelsPath, 'utf8'));
    console.log(`Loaded ${Object.keys(labels).length} ground-truth labels from labels.json`);
  } else {
    console.log('No labels.json found -> measuring latency only (no accuracy).');
  }

  const files = (await readdir(IMAGE_DIR)).filter((f) =>
    Object.keys(EXT_TO_MIME).includes(path.extname(f).toLowerCase()),
  );
  if (files.length === 0) {
    console.error(`No images (${Object.keys(EXT_TO_MIME).join(', ')}) in ${IMAGE_DIR}`);
    process.exit(1);
  }

  console.log(`\nMeasuring ${files.length} image(s) against ${ENDPOINT}\n`);

  const latencies = [];
  let typeCorrect = 0;
  let typeTotal = 0;
  let colorCorrect = 0;
  let colorTotal = 0;
  let errors = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const mime = EXT_TO_MIME[ext];
    const buf = await readFile(path.join(IMAGE_DIR, file));
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const t0 = performance.now();
    let resp, body;
    try {
      resp = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUrl }),
      });
      body = await resp.json();
    } catch (e) {
      errors++;
      console.log(`  ✗ ${file.padEnd(28)} request failed: ${e.message}`);
      continue;
    }
    const ms = performance.now() - t0;

    if (!resp.ok) {
      errors++;
      console.log(`  ✗ ${file.padEnd(28)} HTTP ${resp.status}: ${JSON.stringify(body)}`);
      continue;
    }

    latencies.push(ms);

    const gt = labels[file];
    let mark = '';
    if (gt) {
      if (gt.type != null) {
        typeTotal++;
        if (norm(body.type) === norm(gt.type)) {
          typeCorrect++;
          mark += ' type✓';
        } else {
          mark += ` type✗(got ${body.type})`;
        }
      }
      if (gt.color != null) {
        colorTotal++;
        if (norm(body.color) === norm(gt.color)) {
          colorCorrect++;
          mark += ' color✓';
        } else {
          mark += ` color✗(got ${body.color})`;
        }
      }
    }
    console.log(
      `  ✓ ${file.padEnd(28)} ${ms.toFixed(0).padStart(5)}ms  ` +
        `-> ${body.type}/${body.color}${mark}`,
    );
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  console.log('\n================ VISION PIPELINE MEASUREMENT ================');
  console.log(`Endpoint: ${ENDPOINT}`);
  console.log(`Model:    claude-haiku-4-5 (per src/app/api/detect-clothing/route.ts)`);
  console.log(
    `Images:   ${files.length} attempted, ${latencies.length} succeeded, ${errors} errors`,
  );
  console.log('------------------------------------------------------------');
  console.log('Latency (end-to-end request round-trip, ms):');
  console.log(`  median: ${median(latencies).toFixed(0)}`);
  console.log(`  mean:   ${mean(latencies).toFixed(0)}`);
  console.log(`  p95:    ${pct(sorted, 95).toFixed(0)}`);
  console.log(
    `  min:    ${(sorted[0] ?? NaN).toFixed(0)}   max: ${(sorted[sorted.length - 1] ?? NaN).toFixed(0)}`,
  );
  if (typeTotal > 0 || colorTotal > 0) {
    console.log('------------------------------------------------------------');
    console.log('Accuracy vs. ground truth:');
    if (typeTotal > 0)
      console.log(
        `  type:  ${typeCorrect}/${typeTotal} = ${((typeCorrect / typeTotal) * 100).toFixed(0)}%`,
      );
    if (colorTotal > 0)
      console.log(
        `  color: ${colorCorrect}/${colorTotal} = ${((colorCorrect / colorTotal) * 100).toFixed(0)}%`,
      );
  }
  console.log('============================================================\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
