import { describe, it, expect, vi } from 'vitest';
import { parseWearFeatures, relearn, wearItems, type LearningRow } from '@/lib/outfitLearning';
import {
  computeReward,
  defaultModel,
  forgetReward,
  updateWeights,
  type BanditModel,
  type FeatureVector,
} from '@/lib/banditModel';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {} }));

const AS_WORN: FeatureVector = { color: 1, variety: 0.8, rating: 0.6 };
const REBUILT: FeatureVector = { color: 0.25, variety: 1, rating: 0.5 };
const ITEMS = { top_id: 't1', bottom_id: 'b1', shoes_id: 's1' };
const stored = (values: FeatureVector, items = ['t1', 'b1', 's1']) => ({ items, values });

const expectSamePosterior = (a: BanditModel, b: BanditModel) => {
  a.posterior.precision.forEach((row, i) =>
    row.forEach((v, j) => expect(v).toBeCloseTo(b.posterior.precision[i][j], 8)),
  );
  a.posterior.target.forEach((v, i) => expect(v).toBeCloseTo(b.posterior.target[i], 8));
};

describe('relearn', () => {
  const base = defaultModel();
  const rebuild = vi.fn(() => REBUILT);

  it('does nothing for an unrated wear the model never learned', () => {
    expect(relearn(base, { ...ITEMS, rating: null }, rebuild)).toBeNull();
  });

  it('learns a new rating from the features stored when the outfit was worn', () => {
    rebuild.mockClear();
    const row: LearningRow = { ...ITEMS, rating: 8, features: stored(AS_WORN) };
    const out = relearn(base, row, rebuild)!;
    expect(rebuild).not.toHaveBeenCalled();
    expect(out.learnedRating).toBe(8);
    expect(out.features).toEqual({ items: ['t1', 'b1', 's1'], values: AS_WORN });
    expectSamePosterior(out.model, updateWeights(base, AS_WORN, computeReward(8)));
  });

  it('rebuilds features for a wear logged without them', () => {
    rebuild.mockClear();
    const out = relearn(base, { ...ITEMS, rating: 6 }, rebuild)!;
    expect(rebuild).toHaveBeenCalledOnce();
    expect(out.features?.values).toEqual(REBUILT);
    expectSamePosterior(out.model, updateWeights(base, REBUILT, computeReward(6)));
  });

  it('is a no-op when the learned rating is already current', () => {
    const row: LearningRow = { ...ITEMS, rating: 8, features: stored(AS_WORN), learned_rating: 8 };
    expect(relearn(base, row, rebuild)).toBeNull();
  });

  it('replaces a changed rating without double-counting', () => {
    const learned7 = updateWeights(base, AS_WORN, computeReward(7));
    const row: LearningRow = { ...ITEMS, rating: 9, features: stored(AS_WORN), learned_rating: 7 };
    const out = relearn(learned7, row, rebuild)!;
    expect(out.learnedRating).toBe(9);
    expect(out.model.meta.updates).toBe(1);
    expectSamePosterior(out.model, updateWeights(base, AS_WORN, computeReward(9)));
  });

  it('forgets a rating that was cleared', () => {
    const learned = updateWeights(base, AS_WORN, computeReward(4));
    const row: LearningRow = {
      ...ITEMS,
      rating: null,
      features: stored(AS_WORN),
      learned_rating: 4,
    };
    const out = relearn(learned, row, rebuild)!;
    expect(out.learnedRating).toBeNull();
    expect(out.model.meta.updates).toBe(0);
    expectSamePosterior(out.model, base);
  });

  it('when items change, forgets the old outfit and learns the new one', () => {
    rebuild.mockClear();
    const learned = updateWeights(base, AS_WORN, computeReward(5));
    const row: LearningRow = {
      top_id: 't2', // swapped top
      bottom_id: 'b1',
      shoes_id: 's1',
      rating: 5,
      features: stored(AS_WORN),
      learned_rating: 5,
    };
    const out = relearn(learned, row, rebuild)!;
    expect(rebuild).toHaveBeenCalledOnce();
    expect(out.features?.items).toEqual(['t2', 'b1', 's1']);
    expectSamePosterior(out.model, updateWeights(base, REBUILT, computeReward(5)));
  });

  it("doesn't learn an incomplete outfit", () => {
    const out = relearn(
      base,
      { top_id: 't1', bottom_id: null, shoes_id: 's1', rating: 8 },
      rebuild,
    )!;
    expect(out.learnedRating).toBeNull();
    expect(out.model.meta.updates).toBe(0);
  });
});

describe('forgetReward', () => {
  it('exactly undoes updateWeights', () => {
    const base = updateWeights(defaultModel(), REBUILT, 0.3);
    const roundTrip = forgetReward(updateWeights(base, AS_WORN, 0.9), AS_WORN, 0.9);
    expectSamePosterior(roundTrip, base);
    expect(roundTrip.meta.updates).toBe(base.meta.updates);
  });
});

describe('parseWearFeatures / wearItems', () => {
  it('accepts well-formed stored features and rejects anything else', () => {
    expect(parseWearFeatures(stored(AS_WORN))).toEqual(stored(AS_WORN));
    expect(parseWearFeatures(null)).toBeNull();
    expect(parseWearFeatures({ items: ['t1'], values: AS_WORN })).toBeNull();
    expect(parseWearFeatures({ items: ['t1', 'b1', 's1'], values: { color: 1 } })).toBeNull();
  });

  it('lists a wear’s items, with null for missing slots', () => {
    expect(wearItems({ top_id: 't1', shoes_id: 's1' })).toEqual(['t1', null, 's1']);
  });
});
