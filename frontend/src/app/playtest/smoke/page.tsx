// Smoke-test page — mounts Board directly with a deterministic config so
// the playing-mode render path can be exercised without clicking through the
// setup screen. Used for headless verification.

import { SmokeClient } from './SmokeClient';

export default function SmokePage() {
  return <SmokeClient />;
}
