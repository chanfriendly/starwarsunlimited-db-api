// Public surface of the real-card → engine-v2 translator.
export {
  buildGameFromDecks,
  translateCard,
  translateBase,
  parseKeywords,
  normalizeType,
  normalizeAspects,
  normalizeArena,
  normalizeTraits,
} from './translate';
export type { BuildGameOptions, BuiltGame, TranslateResult } from './translate';
export { matchCard, parseEffectClause } from './match';
export type { MatchableCard, MatchResult, Coverage } from './match';
