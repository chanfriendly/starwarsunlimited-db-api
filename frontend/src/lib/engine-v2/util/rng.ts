// Deterministic seedable PRNG. Used by the runtime where rule-mandated
// randomization (e.g. deck shuffle after a search, per §v7 8.36) needs to be
// stable under the replay-based async step model: the same state must always
// produce the same shuffle when re-executed with the same journal.
//
// `state.step` is the canonical seed source — it's monotonically incremented
// on every step() call, so consecutive operations within one step share a
// seed (acceptable for the rare double-shuffle case) and consecutive top-level
// steps get fresh randomness. No Math.random / Date.now anywhere.

/** mulberry32 — fast, small, deterministic 32-bit PRNG. Adequate for shuffling. */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic Fisher-Yates shuffle. Pure: returns a new array. */
export function shuffleDeterministic<T>(arr: T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
