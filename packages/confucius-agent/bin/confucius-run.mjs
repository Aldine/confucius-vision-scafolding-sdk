#!/usr/bin/env node

/**
 * Confucius Agent CLI - Thin forwarder to recursion engine
 * 
 * This CLI is the public interface. It forwards to the internal
 * engine CLI while setting strict defaults for agentic contexts.
 * 
 * Exit codes:
 *   0 - Success (contract satisfied)
 *   1 - Proof failed (runtime error)
 *   2 - tool_missing_strict (strict mode + no runSubagent)
 *   5 - ASLEEP (contract violated or FORCE_SLEEP)
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve path to recursion-sdk CLI
const sdkPath = join(__dirname, '..', 'node_modules', '@aldine', 'confucius-recursion-sdk', 'dist', 'cli-worker.js');

// Set strict defaults for agentic context (user can override)
const env = {
  ...process.env,
  CONFUCIUS_USE_WORKER: process.env.CONFUCIUS_USE_WORKER ?? 'true',
  CONFUCIUS_STRICT_MODE: process.env.CONFUCIUS_STRICT_MODE ?? 'true'
};

// Forward all CLI args to engine
const child = spawn('node', [sdkPath, ...process.argv.slice(2)], {
  env,
  stdio: 'inherit'
});

child.on('close', (code) => {
  process.exit(code ?? 1);
});

child.on('error', (err) => {
  console.error('Failed to start Confucius engine:', err.message);
  process.exit(1);
});
