import { describe, expect, it } from 'vitest';

import { isOverlyDivergentRefinement } from '$lib/services/refiner';

describe('refiner safeguards', () => {
  it('allows small transcript edits', () => {
    expect(isOverlyDivergentRefinement('That is no spoon.', 'There is no spoon.')).toBe(false);
  });

  it('rejects unrelated rewrites', () => {
    expect(isOverlyDivergentRefinement('That is no spoon.', 'You are gonna need a bigger boat.')).toBe(true);
  });
});
