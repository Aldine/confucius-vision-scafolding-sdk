#!/usr/bin/env node
/**
 * Test helper: Expect exit code 5 (asleep detected)
 * Returns exit 0 if CLI exits with 5, otherwise exit 1
 */

import { spawnSync } from "node:child_process";

const result = spawnSync("node", ["dist/cli.js"], {
  stdio: "inherit",
  env: { ...process.env, CONFUCIUS_FORCE_SLEEP: "true" }
});

// Success = got exit code 5 (asleep detected)
if (result.status === 5) {
  console.log("\n✓ Test passed: Exit code 5 received (asleep detected)");
  process.exit(0);
} else {
  console.error(`\n✗ Test failed: Expected exit 5, got ${result.status}`);
  process.exit(1);
}
