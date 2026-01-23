#!/usr/bin/env node

/**
 * Dist Presence Test - Verifies build artifacts exist
 * 
 * Prevents tree shaking and build config regressions from dropping critical files.
 * 
 * Exit codes:
 *   0 - All required files present
 *   1 - Missing files detected
 */

import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '..', 'dist');

const REQUIRED_FILES = [
  'worker/orchestrator.worker.js',
  'cli-worker.js',
  'cli.js',
  'index.js',
  'asleep-detector.js',
  'index.d.ts',
  'cli-worker.d.ts',
  'asleep-detector.d.ts'
];

function checkDistPresence() {
  const missing = [];
  
  for (const file of REQUIRED_FILES) {
    const fullPath = resolve(distDir, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
    }
  }
  
  if (missing.length > 0) {
    console.error(JSON.stringify({
      ok: false,
      error: 'dist_presence_check_failed',
      message: 'Required build artifacts are missing. Tree shaking or build config issue.',
      missing: missing,
      required: REQUIRED_FILES
    }, null, 2));
    process.exit(1);
  }
  
  console.log(JSON.stringify({
    ok: true,
    message: 'All required build artifacts present',
    checked: REQUIRED_FILES.length
  }, null, 2));
  process.exit(0);
}

checkDistPresence();
