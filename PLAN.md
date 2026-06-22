# FitFinder — Technical Enhancement Plan

Branch: `wip`

This plan covers two workstreams:
- **A. Smarter, more seamless clothing upload** (auto type/color detection, on-demand background removal, batch upload, multi-color detection)
- **B. Learning outfit generation** via a **client-side contextual bandit** trained on existing wear/rating signals

All ML scoring runs **client-side in TypeScript** (no new infra), consistent with the current `outfitScoring.ts` approach.

---

## Guiding principles

- **Build on what exists.** The app already collects ratings, wear history, and color preferences but never feeds them back into generation (every outfit gets `score=1`, `outfitScoring.ts:127`). The bandit closes this loop.
- **Interpretable & sparse-data-friendly.** A single user has limited history; the model must work from the first few interactions (cold start) and be explainable.
- **No backend ML service.** Scoring + online learning happen in the browser; learned weights persist to Supabase per user.
- **Incremental & shippable.** Each phase is independently valuable and testable.

---

# Workstream A — Seamless Upload

**Goal:** The user picks a photo (or several) and the app pre-fills type + primary/secondary colors automatically; the user only *reviews and corrects*. Background removal is offered as a one-click option but is **not** applied automatically, and the removed image is uploaded **untouched** (smooth, anti-aliased edges).

### A0. Auto-detection + on-demand background removal (the core of this workstream)

**Original state:** the flow was a sequence of manual steps — choose file → manually crop → optionally click "Remove Background" → optionally click "Auto-Detect" → manually pick color/type.

**Shipped flow:** on file select the image is shown immediately and detection runs in the background to pre-fill the form:

```
detectItem(blob):              // does NOT modify the image
  - Color detection (A4)       primary + optional secondary, local pixel sampling
  - Type detection             Claude /api/detect-clothing (existing)
  → returns { suggestedType, suggestedSection, suggestedColors: [primary, secondary?] }

removeImageBackground(blob):   // on-demand, user-triggered
  - @imgly/background-removal, result returned UNTOUCHED → uploaded as-is
```

**Why this shape (revised after testing):** an earlier version ran background removal automatically and then hard-thresholded + framed/scaled the result. Thresholding destroyed the model's anti-aliased edge and produced a jagged outline, and the auto-framing inflated bounding boxes around the model's halo. We reverted to uploading the model output untouched (which always looked clean) and made background removal an explicit, optional step. Auto type/color detection — the genuinely seamless part — was kept.

**Files:**
- `src/lib/uploadPipeline.ts` — `detectItem` (detection only), `removeImageBackground` (untouched), `uploadItem`.
- `src/components/ImageUpload.tsx` — select → review flow; background-removal button; auto-prefilled, correctable fields.

### A1. Auto-frame / scale normalization — **dropped**

Attempted (alpha bounding box → crop → scale to a per-section fill target in a 512×512 frame, `imageNormalize.ts`) but removed: it depended on hard-thresholding the matte, which roughened edges, and the framing keyed off a noisy halo. The `imageNormalize.ts` module and the `sectionScaleTargets`/`defaultScaleTarget` constants were deleted. If true to-scale rendering is wanted later, it can be done by scaling the model's soft matte directly (no thresholding).

### A4. Color detection — primary + optional secondary

**Problem:** `colors` is `text[]` but only one color is ever stored (`setSelectedColors([color])`, e.g. `ImageUpload.tsx:161`). `extractDominantColor` returns only the single most frequent palette color.

**Approach (shipped):**
1. Extraction returns a **ranked list** of palette colors with frequencies; keep the top 1–2 above a coverage threshold (secondary must cover ≥15% of non-background pixels) → primary + optional secondary. Skips transparent/near-white pixels, so it works on both the original and the background-removed image. Detection re-runs automatically after the user removes the background (cleaner colors).
2. Claude `/api/detect-clothing` prompt extended to return `secondaryColor`; validated against the palette like the existing `type`/`color` validation (`route.ts:61`).
3. Stored as `colors` with **primary at index 0** to preserve existing `colors[0]` assumptions (`outfitScoring.ts:90`). Secondary at index 1 when present.

**Compatibility:** Keeping primary at `colors[0]` means existing generation/preference logic keeps working unchanged.

**Files:** `src/lib/imageColor.ts` (extracted from ImageUpload), `src/app/api/detect-clothing/route.ts`.

### A5. Correction UI (user fixes the auto-detected result)

After detection runs, the review screen lets the user override every auto-filled field:
- **Type** — category/type selects, pre-selected from detection (spinner while detecting).
- **Primary color** — palette picker, pre-selected from detection. Required.
- **Secondary color** — second palette picker, pre-selected if detected. **Optional**, with an explicit **"No secondary color"** control to clear it. When cleared, `colors` has a single element.
- **Remove background** — optional one-click button; uploads the model output untouched.

This is the only required interaction: glance, correct if needed, confirm.

### A2. Batch / multi-upload — **shipped**

**Approach (as built):** The single-item modal was **unified** into one batch-capable modal
rather than a separate component. Internally it holds an array of `ItemDraft`s (each with its
own blob, preview URL, fields, and status flags):
1. The file input accepts `multiple`; N files become N drafts.
2. Drafts are auto-detected through **`detectItem`** (A0) with a `runWithConcurrency` helper
   (limit 3) to respect Claude rate limits. Background removal stays per-item and on-demand.
3. **1 file → existing detailed view; N files → a responsive review grid** (one compact card
   per item) reusing the A5 correction UI (type, primary, optional secondary, dirty toggle,
   remove-background). A per-card ✕ drops an item before upload.
4. **Upload All** runs `uploadItem(...)` with concurrency 3 and per-item status. `onItemUploaded`
   fires **once per successful item**. On partial failure the modal stays open showing only the
   failed cards (reset to `pending`) for retry; on full success it resets + closes.

**Files (as built):**
- `src/lib/uploadPipeline.ts` — added shared `runWithConcurrency` helper; `detectItem` /
  `removeImageBackground` / `uploadItem` reused unchanged.
- `src/components/ImageUpload.tsx` — drafts array, detection, grid + detailed rendering, batch
  upload. Public props unchanged, so `page.tsx` / `Onboarding.tsx` call sites needed no edits.
- `src/__tests__/lib/uploadPipeline.test.ts` — `runWithConcurrency` unit tests.

---

# Workstream B — Contextual Bandit Outfit Generation

### Concept

Replace random selection (`outfitScoring.ts:114-128`) with **score-then-sample**:
- Each candidate outfit gets a **predicted reward** from a linear model over features (the "context").
- Selection uses **explore/exploit**: usually pick high-scoring outfits, sometimes explore uncertain ones so the model keeps learning. (Approach: ε-greedy first for simplicity, with a clear path to LinUCB/Thompson sampling for uncertainty-aware exploration.)
- After the user **wears + rates** an outfit, we compute a reward and **update the weights online**.

This is a contextual bandit: context = outfit features, action = which outfit to surface, reward = derived from rating/save/wear signals.

### Reward signal (from existing data)

Derived from `outfit_wears` (`types.ts:55`) and `saved_outfits`:
- `rating` (1–10) → normalized to [0,1]. This is the single explicit signal (comfort rating is being removed — see "Removing comfort rating" below).
- Implicit: **saved** outfit = mild positive; **worn** = positive engagement; generated-but-never-acted-on = weak negative (optional, later).
- Missing ratings are simply skipped (no reward, no update).

### Removing the comfort rating

Comfort rating is being removed entirely so the single rating drives everything. It currently appears in 8 source locations:

- `src/lib/types.ts:65` — drop `comfort_rating?` from `OutfitWear`.
- `src/components/RatingPrompt.tsx:11,19,20,58,134-155` — remove the `comfortRating`/`showComfort` state, the "Add comfort rating (optional)" checkbox, and the comfort slider; `onSubmit` signature drops the 3rd arg.
- `src/app/page.tsx:101,104` — `handleRatingSubmit` drops `comfortRating`; stop writing `comfort_rating`.
- `src/components/WardrobeStats.tsx:128-131,291` — remove the avg-comfort calc and the "comfort rated" stat tile.
- `src/__tests__/components/RatingPrompt.test.tsx:123,137` — delete the two comfort tests.
- `src/__tests__/lib/outfitScoring.test.ts:178,191` — drop `comfort_rating` from fixtures; rename the "comfort scoring" describe block.
- `README.md` — remove comfort mention.
- **DB:** new migration `007_drop_comfort_rating.sql` runs `ALTER TABLE outfit_wears DROP COLUMN comfort_rating` (decision: drop the column).

This is **Phase 0** — done first, standalone, before the upload pipeline.

### Features (context vector) — all derivable today

Per candidate outfit `{top, bottom, shoes}`:
1. **Color-pair features:** indicator/affinity for the top–bottom color pair (seeded by `color_preferences.liked/disliked_combinations`). Bidirectional like `pairMatchesLiked` (`outfitScoring.ts:39`).
2. **Per-item affinity:** learned weight per `item.id` (how well-rated outfits containing this item have been).
3. **Type-pair features:** e.g. "T-Shirt + Jeans" vs "Dress Shirt + Chinos".
4. **Weather fit:** alignment with `suggestedIn`/`blockedIn` for current `TemperatureCategory` (reuses `getUserClothingWeatherRules`).
5. **Recency/repetition penalty:** down-weight items/combos worn very recently (from `outfit_wears.worn_date`) to keep suggestions fresh.
6. *(Later, after A4)* secondary-color harmony.

### Model

- **Linear scorer:** `score = w · features`, weights `w` stored per user.
- **Online update:** on each new reward, gradient step (`w += lr · (reward − predicted) · features`) — standard online linear regression / LinUCB-compatible.
- **Cold start:** initialize weights from explicit `color_preferences` (liked = +, disliked = −) and weather rules so behavior is sensible before any ratings exist. Degrades gracefully to current behavior when there's no data.
- **Why linear:** interpretable (can show *why* an outfit was suggested), trains on tiny data, runs instantly in-browser. We can swap in a richer model later behind the same interface.

### Persistence

New table `outfit_model_weights`:
```
user_id        uuid PK (FK auth.users)
weights        jsonb         -- feature_name -> weight
feature_meta   jsonb         -- versioning, normalization stats, item-id index
updated_at     timestamptz
```
RLS identical to existing per-user tables (`001_outfit_wears.sql` pattern). Migration `008_outfit_model_weights.sql`.

### Generation flow changes

`generateScoredOutfits` (`outfitScoring.ts:51`) becomes:
1. Categorize + weather-filter (unchanged, `:57-78`).
2. Build candidate outfits (top×bottom×shoes), capped to a sane number via sampling for large closets.
3. **Featurize** each candidate; **score** with loaded weights.
4. **Select** via ε-greedy: top-scoring outfits + occasional exploration; dedupe (keep existing `seen` set, `:119`).
5. Populate real `score` instead of `1`, so the UI can optionally show confidence/why.

Locks (user-frozen slots, `OutfitGenerator.tsx`) are respected by constraining candidates to the locked items before scoring.

### Learning loop wiring

- The existing **RatingPrompt** (`RatingPrompt.tsx`, triggered in `page.tsx:68`) already collects yesterday's rating. On submit, call `updateModel(wear, reward)` to apply the online update and persist weights.
- Saving an outfit emits a mild positive reward.

**Files:**
- New `src/lib/banditModel.ts` — `featurize(outfit, ctx)`, `scoreOutfit`, `selectOutfits` (ε-greedy), `updateWeights(reward, features)`, `initWeightsFromPreferences(...)`, load/save to Supabase.
- Edit `src/lib/outfitScoring.ts` — swap random pick for score+select; keep signature backward-compatible (extend `ScoringContext` with optional `model`).
- Edit `src/components/OutfitGenerator.tsx` — load model weights on mount alongside existing fetches; surface optional "why this outfit".
- Edit `src/components/RatingPrompt.tsx` / `src/app/page.tsx` — call model update on rating submit.
- New migration `supabase_migrations/008_outfit_model_weights.sql`.

---

# Phasing (each phase independently shippable & testable)

**Phase 0 — Remove comfort rating** *(do first)*
- Strip comfort from all 8 source locations (see "Removing the comfort rating") + migration `007_drop_comfort_rating.sql`.
- Deliverable: rating is the sole outfit signal; tests green.

**Phase 1 — Seamless single-item upload** *(done)*
- A0 auto-detection + on-demand background removal + A4 color detection + A5 correction UI; `uploadPipeline.ts`. A1 framing/scale was attempted and dropped (see A1).
- Deliverable: pick one photo → type + primary/secondary colors pre-filled; optional one-click background removal (uploaded untouched); user reviews/corrects (including "no secondary color").

**Phase 2 — Batch upload** *(done)*
- A2 batch grid in the unified `ImageUpload` modal reusing `detectItem` (concurrency 3 via
  `runWithConcurrency`) + A5 correction UI per card; per-item optional background removal.
- Deliverable: upload many items at once, each auto-detected, corrected in a grid; Upload All
  with per-item progress, once-per-item refresh, and failed-card retry.

**Phase 3 — Deterministic scorer scaffolding (no learning yet)** *(done)*
- Built a **fixed-weight linear scorer directly in `outfitScoring.ts`** (the design the
  existing test suite already specified) rather than a separate `banditModel.ts`. The five
  feature functions (`colorFeature`, `weatherFeature`, `varietyFeature`, `occasionFeature`,
  `ratingFeature`, each → [0,1]) and their fixed `FEATURE_WEIGHTS` (0.30/0.25/0.20/0.15/0.10,
  sum 1.0) **are** the bandit's featurization + cold-start priors; Phase 4 swaps the fixed
  weights for learned ones behind the same `scoreOutfit` interface.
- `ScoringContext` extended with `recentWears`, `occasion`, `occasionRules`, `ratedOutfits`.
- `generateScoredOutfits` now scores **every** top×bottom×shoes candidate, sorts descending,
  returns the top `count` (ties jittered). `OutfitGenerator.pickOutfit` requests 10 and samples
  among the top 5 so repeated clicks stay fresh while favoring high scores.
- `OutfitGenerator` now fetches recent wears (≤14d, variety) and rated wears (rating boost).
- **DB:** none yet — no learned weights to persist. `008_outfit_model_weights.sql` deferred to Phase 4.
- Deliverable: outfits scored (not random) using interpretable priors; the previously
  aspirational `outfitScoring.test.ts` / `OutfitGenerator.test.tsx` cases now pass. No learning yet.

**Phase 4 — Online learning loop** *(done)*
- New `src/lib/banditModel.ts` — pure online linear model over the five
  `FEATURE_NAMES`/`featureVector` from Phase 3 (no React; only pure (de)serialization):
  - `defaultModel()` cold-starts weights from the fixed `FEATURE_WEIGHTS` (so cold-start
    `predict` == the Phase 3 score) and `normalizeModel()` backfills missing/old weights.
  - `predict`/`rawScore` (clamped to [0,1]), `computeReward(rating 1–10 → [0,1])`,
    `SAVED_OUTFIT_REWARD` mild positive.
  - `updateWeights(model, features, reward, lr)` — immutable online gradient step
    (`w += lr·(reward−pred)·feature`, plus bias); increments `meta.updates`.
  - `selectOutfits(candidates, params, {epsilon,count,rng})` — ε-greedy explore/exploit
    with an injectable RNG for deterministic tests.
  - `serializeModel`/`deserializeModel` — row JSON ↔ model (bias under `__bias`; legacy/empty
    rows fall back to cold start).
- `outfitScoring.ts` refactored: `FEATURE_NAMES` + `featureVector()` are the single
  featurization source; new `buildCandidates()` (categorize → weather-filter → featurize) is
  shared by the deterministic scorer and the bandit.
- **DB:** `supabase_migrations/008_outfit_model_weights.sql` — `outfit_model_weights(user_id PK,
  weights jsonb, feature_meta jsonb, updated_at)` with the `FOR ALL` per-user RLS pattern.
  *(Manual step: run this in Supabase.)*
- **UI wiring:**
  - `OutfitGenerator` loads the model in its mount fetch; `pickOutfit` featurizes via
    `buildCandidates` then selects with `selectOutfits` (ε-greedy). Locked slots constrain the
    candidate pool before scoring. Saving an outfit applies `SAVED_OUTFIT_REWARD` + upserts.
  - `page.tsx` `handleRatingSubmit` → `applyRatingReward`: fetches the rated outfit's items +
    color prefs + current model, recomputes `featureVector` (weather/occasion neutral, per the
    decision), `updateWeights(computeReward(rating))`, upserts. Best-effort (never blocks rating).
- Tests: `src/__tests__/lib/banditModel.test.ts` (26) — cold-start == priors, reward mapping,
  immutable + convergent online updates, deterministic seeded ε-greedy, serialize round-trip.
- Deliverable: generation adapts online to ratings (and mildly to saves), weights persisted per
  user. 240 tests total; only the pre-existing flaky `ColorCombinationModal` timing test fails.

**Phase 5 (optional) — Uncertainty-aware exploration**
- Upgrade ε-greedy → LinUCB/Thompson sampling for smarter exploration; recency/repetition tuning.

---

# Testing strategy

- Vitest is already set up (`src/__tests__`). Add unit tests for:
  - `imageColor.ts` (primary/secondary thresholds).
  - `banditModel.ts` (cold-start from preferences, monotonic weight updates toward rewarded features, deterministic scoring with seeded RNG for explore/exploit).
- Keep `generateScoredOutfits` covered: same inputs + zero-model should match prior behavior (regression guard).

---

# Open questions / decisions deferred

1. **To-scale rendering (A1)** — dropped for now (thresholding roughened edges). If revisited, scale the model's soft matte directly instead of hard-thresholding.
2. **Explore rate (ε)** — start with a sensible default, expose later in Preferences.
3. **Batch auto-tag concurrency limit** — default 3; tune against Anthropic rate limits.
