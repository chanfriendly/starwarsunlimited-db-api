// Engine-v2 UI UAT harness. Lets a human play a game in the browser against
// an AI using the v2 engine end-to-end — choices flow through the async
// stepAsync/resolveStep protocol, board state comes from the pure engine,
// and AI seats are auto-dispatched via the heuristic chooser.
//
// This is intentionally separate from /game (which still runs v1). When v2
// reaches feature parity with v1's card pool, this route will replace /game.

import { PlaytestClient } from './PlaytestClient';

export default function PlaytestPage() {
  return <PlaytestClient />;
}
