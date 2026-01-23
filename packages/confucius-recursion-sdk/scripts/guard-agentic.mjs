#!/usr/bin/env node

/**
 * Guard script - enforces agentic contract for strict mode proof
 * 
 * Only enforces when:
 * - proof.strictMode === true, OR
 * - CONFUCIUS_AGENTIC env var is set
 * 
 * Local development proofs (strictMode=false) are accepted without full engagement.
 * 
 * Exit codes:
 *   0 - Valid proof found
 *   5 - No proof, invalid proof, stale proof, or agentic contract violated
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROOF_PATH = resolve(__dirname, '..', '.confucius', 'last-proof.json');
const DEFAULT_MAX_AGE_MIN = 10;

function guardAgenticWork() {
  const enforceAgenticContract = process.env.CONFUCIUS_AGENTIC === 'true';
  const maxAgeMin = parseInt(process.env.CONFUCIUS_PROOF_MAX_AGE_MIN || String(DEFAULT_MAX_AGE_MIN), 10);
  const MAX_AGE_MS = maxAgeMin * 60 * 1000;

  // Check if proof file exists
  if (!existsSync(PROOF_PATH)) {
    console.error(JSON.stringify({
      ok: false,
      error: 'proof_missing',
      message: 'No proof artifact found. Run "Confucius: Verify Agent Ready (Strict)" first.',
      proofPath: PROOF_PATH
    }));
    process.exit(5);
  }

  // Parse and validate proof
  let proof;
  try {
    const content = readFileSync(PROOF_PATH, 'utf-8');
    proof = JSON.parse(content);
  } catch (err) {
    console.error(JSON.stringify({
      ok: false,
      error: 'proof_invalid_json',
      message: 'Proof artifact is not valid JSON',
      parseError: err.message
    }));
    process.exit(5);
  }

  // Check if proof is fresh - ALWAYS enforced, regardless of strictMode
  // Parse timestampMs from proof (canonical field)
  let timestampMs;
  
  if (typeof proof.timestampMs === 'number') {
    timestampMs = proof.timestampMs;
  } else if (typeof proof.timestamp === 'string') {
    timestampMs = Date.parse(proof.timestamp);
    if (isNaN(timestampMs)) {
      console.error(JSON.stringify({
        ok: false,
        error: 'proof_timestamp_invalid',
        message: 'Proof timestamp is not a valid ISO date string',
        timestamp: proof.timestamp
      }));
      process.exit(5);
    }
  } else if (typeof proof.writtenAtMs === 'number') {
    timestampMs = proof.writtenAtMs;
  } else {
    console.error(JSON.stringify({
      ok: false,
      error: 'missing_timestamp',
      message: 'Proof artifact missing timestampMs, timestamp, or writtenAtMs field',
      proof: proof
    }));
    process.exit(5);
  }

  const ageMs = Date.now() - timestampMs;
  
  if (ageMs > MAX_AGE_MS) {
    console.error(JSON.stringify({
      ok: false,
      error: 'proof_stale',
      message: `Proof is ${Math.floor(ageMs / 1000 / 60)} minutes old. Maximum age: ${maxAgeMin} minutes.`,
      ageMinutes: Math.floor(ageMs / 1000 / 60),
      maxAgeMinutes: maxAgeMin,
      timestampMs,
      now: Date.now()
    }));
    process.exit(5);
  }

  // Determine if we need agentic contract
  const requiresAgenticContract = proof.strictMode === true || enforceAgenticContract;

  // Always require proof.ok === true
  if (!proof.ok) {
    console.error(JSON.stringify({
      ok: false,
      error: 'proof_failed',
      message: 'Proof verification failed',
      proof: proof
    }));
    process.exit(5);
  }

  // If agentic contract required, enforce it
  if (requiresAgenticContract) {
    // Must be real runtime
    if (proof.runtimeMode !== 'real') {
      console.error(JSON.stringify({
        ok: false,
        error: 'agentic_contract_violated_runtime',
        message: 'Agentic contract requires runtimeMode=real',
        runtimeMode: proof.runtimeMode,
        strictMode: proof.strictMode,
        contractMode: proof.contractMode || 'unknown'
      }));
      process.exit(5);
    }

    // Must have engagement flags
    const engagement = proof.engagement || {};
    const requiredEngagement = [
      'hasPreflightOk',
      'hasPlanCreated',
      'hasSpawnOrRequest',
      'hasProofVerified'
    ];
    
    const missingEngagement = requiredEngagement.filter(flag => !engagement[flag]);

    if (missingEngagement.length > 0) {
      console.error(JSON.stringify({
        ok: false,
        error: 'agentic_contract_violated_engagement',
        message: 'Agentic contract requires full engagement evidence',
        missingEngagement,
        engagement
      }));
      process.exit(5);
    }
  }

  // Local mode: just needs proof.ok === true (already checked above)

  // All checks passed
  const guardOutput = {
    ok: true,
    message: 'Valid proof found',
    contractMode: proof.contractMode || (requiresAgenticContract ? 'agentic' : 'local'),
    runtimeMode: proof.runtimeMode,
    strictMode: proof.strictMode,
    ageMinutes: Math.floor(ageMs / 1000 / 60),
    verification: proof.verification,
    traceMarker: 'guard_checked' // Trace marker for enforcement path coverage
  };
  
  console.log(JSON.stringify(guardOutput));
  process.exit(0);
}

guardAgenticWork();
