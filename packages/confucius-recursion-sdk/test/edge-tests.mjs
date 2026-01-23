#!/usr/bin/env node

/**
 * Edge Tests - Deterministic enforcement validation
 * 
 * Tests that enforcement cannot be bypassed and edge cases are handled.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const proofPath = resolve(rootDir, '.confucius', 'last-proof.json');

function runCommand(cmd, env = {}) {
  try {
    const result = execSync(cmd, {
      cwd: rootDir,
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      stdio: 'pipe'
    });
    return { exitCode: 0, output: result };
  } catch (err) {
    return { exitCode: err.status || 1, output: err.stdout || err.stderr || '' };
  }
}

function readProof() {
  if (!existsSync(proofPath)) return null;
  return JSON.parse(readFileSync(proofPath, 'utf-8'));
}

function writeProof(proof) {
  writeFileSync(proofPath, JSON.stringify(proof, null, 2), 'utf-8');
}

const tests = [
  {
    name: 'Test 1: Proof artifact contract (local mode)',
    run: () => {
      const result = runCommand('node dist/cli-worker.js', {
        CONFUCIUS_STRICT_MODE: 'false',
        CONFUCIUS_USE_WORKER: 'false',
        CONFUCIUS_FORCE_SLEEP: 'false',
        CONFUCIUS_VERBOSE: 'false'
      });
      
      if (result.exitCode !== 0) {
        return { pass: false, reason: `Exit code ${result.exitCode}, expected 0` };
      }
      
      const proof = readProof();
      if (!proof) {
        return { pass: false, reason: 'No proof artifact written' };
      }
      
      if (proof.contractMode !== 'local') {
        return { pass: false, reason: `contractMode=${proof.contractMode}, expected 'local'` };
      }
      
      if (proof.ok !== true) {
        return { pass: false, reason: `proof.ok=${proof.ok}, expected true` };
      }
      
      return { pass: true };
    }
  },
  
  {
    name: 'Test 2: Strict missing tools (exit 2)',
    run: () => {
      const result = runCommand('node dist/cli-worker.js', {
        CONFUCIUS_STRICT_MODE: 'true',
        CONFUCIUS_USE_WORKER: 'true',
        CONFUCIUS_VERBOSE: 'false'
      });
      
      if (result.exitCode !== 2) {
        return { pass: false, reason: `Exit code ${result.exitCode}, expected 2` };
      }
      
      if (!result.output.includes('tool_missing_strict')) {
        return { pass: false, reason: 'Missing expected error reason' };
      }
      
      return { pass: true };
    }
  },
  
  {
    name: 'Test 3: Guard freshness check',
    run: () => {
      // First generate a proof
      runCommand('node dist/cli-worker.js', {
        CONFUCIUS_STRICT_MODE: 'false',
        CONFUCIUS_USE_WORKER: 'false',
        CONFUCIUS_FORCE_SLEEP: 'false',
        CONFUCIUS_VERBOSE: 'false'
      });
      
      if (!existsSync(proofPath)) {
        return { pass: false, reason: 'Failed to generate proof' };
      }
      
      // Backdate the proof file by 11 minutes
      const stats = statSync(proofPath);
      const elevenMinutesAgo = Date.now() - (11 * 60 * 1000);
      
      // Read and rewrite to update mtime (simulate stale proof)
      const proof = readProof();
      proof.timestamp = new Date(elevenMinutesAgo).toISOString();
      writeProof(proof);
      
      // Touch the file with old timestamp (platform-specific, so we'll just check guard logic)
      const guardResult = runCommand('node scripts/guard-agentic.mjs');
      
      if (guardResult.exitCode !== 5) {
        return { pass: false, reason: `Guard exit code ${guardResult.exitCode}, expected 5 for stale proof` };
      }
      
      if (!guardResult.output.includes('proof_stale')) {
        return { pass: false, reason: 'Missing proof_stale error' };
      }
      
      return { pass: true };
    }
  },
  
  {
    name: 'Test 4: Guard mismatch (strict + simulated)',
    run: () => {
      // Create invalid proof: strictMode=true but runtimeMode=simulated
      const invalidProof = {
        ok: true,
        strictMode: true,
        runtimeMode: 'simulated',
        contractMode: 'agentic',
        engagement: {
          hasPreflightOk: false,
          hasPlanCreated: false,
          hasProofVerified: true,
          hasSpawnOrRequest: true,
          hasQualityGatePass: false
        },
        trace: [],
        timestamp: new Date().toISOString()
      };
      
      writeProof(invalidProof);
      
      const guardResult = runCommand('node scripts/guard-agentic.mjs');
      
      if (guardResult.exitCode !== 5) {
        return { pass: false, reason: `Guard exit code ${guardResult.exitCode}, expected 5` };
      }
      
      if (!guardResult.output.includes('agentic_contract_violated')) {
        return { pass: false, reason: 'Expected agentic_contract_violated error' };
      }
      
      return { pass: true };
    }
  },
  
  {
    name: 'Test 5: Asleep detector with missing engagement',
    run: () => {
      // Run with forced sleep to trigger asleep condition
      const result = runCommand('node dist/cli-worker.js', {
        CONFUCIUS_STRICT_MODE: 'false',
        CONFUCIUS_USE_WORKER: 'false',
        CONFUCIUS_FORCE_SLEEP: 'true',
        CONFUCIUS_VERBOSE: 'false'
      });
      
      // forceSleep should cause exit 1 or 5
      if (result.exitCode === 0) {
        return { pass: false, reason: 'Exit code 0, but forceSleep should fail' };
      }
      
      const proof = readProof();
      if (!proof) {
        return { pass: false, reason: 'No proof artifact' };
      }
      
      // In forceSleep mode, asleepDetector should flag issues
      if (proof.asleepDetector?.ok !== false) {
        return { pass: false, reason: 'asleepDetector should fail with forceSleep' };
      }
      
      return { pass: true };
    }
  }
];

function runAllTests() {
  console.log('Running edge tests...\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    process.stdout.write(`${test.name}... `);
    try {
      const result = test.run();
      if (result.pass) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log(`❌ FAIL: ${result.reason}`);
        failed++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

runAllTests();
