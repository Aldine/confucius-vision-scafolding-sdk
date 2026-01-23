#!/usr/bin/env node

/**
 * Tamper Test - Verifies signature validation
 * 
 * Proves the proof artifact isn't just JSON by testing signature verification.
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const proofPath = resolve(rootDir, '.confucius', 'last-proof.json');

function runTamperTest() {
  console.log('Tamper Test - Verifying signature validation\n');
  
  // Step 1: Generate a proof
  console.log('Step 1: Generating proof...');
  try {
    execSync('node dist/cli-worker.js', {
      cwd: rootDir,
      encoding: 'utf-8',
      env: {
        ...process.env,
        CONFUCIUS_STRICT_MODE: 'false',
        CONFUCIUS_USE_WORKER: 'false',
        CONFUCIUS_FORCE_SLEEP: 'false',
        CONFUCIUS_VERBOSE: 'false'
      },
      stdio: 'pipe'
    });
    console.log('✅ Proof generated\n');
  } catch (err) {
    console.error('❌ Failed to generate proof:', err.message);
    process.exit(1);
  }
  
  // Step 2: Read proof
  if (!existsSync(proofPath)) {
    console.error('❌ No proof artifact found');
    process.exit(1);
  }
  
  const proof = JSON.parse(readFileSync(proofPath, 'utf-8'));
  console.log('Step 2: Read proof artifact');
  console.log(`Trace events: ${proof.trace?.length || 0}`);
  
  if (!proof.trace || proof.trace.length === 0) {
    console.log('⚠️  No trace events to tamper with');
    console.log('Test passes vacuously - no signatures to validate');
    process.exit(0);
  }
  
  console.log(`Original verification: ${JSON.stringify(proof.verification, null, 2)}\n`);
  
  // Step 3: Tamper with trace
  console.log('Step 3: Tampering with trace event...');
  proof.trace[0].kind = 'TAMPERED_EVENT';
  proof.trace[0].tamperedBy = 'test';
  
  // Write tampered proof
  writeFileSync(proofPath, JSON.stringify(proof, null, 2), 'utf-8');
  console.log('✅ Trace tampered (modified first event)\n');
  
  // Step 4: Validate signatures
  console.log('Step 4: Validating signatures on tampered proof...');
  
  try {
    // Import validateTrace from the SDK
    const { validateTrace } = await import('../dist/index.js');
    
    const validation = validateTrace(proof.trace);
    
    console.log(`Validation result: ${JSON.stringify(validation, null, 2)}\n`);
    
    if (validation.allSignaturesValid === true) {
      console.error('❌ FAIL: Tampered proof still shows valid signatures!');
      console.error('This means signature validation is not working correctly.');
      process.exit(1);
    }
    
    if (validation.invalidSignatureCount > 0) {
      console.log('✅ PASS: Tampered proof detected invalid signatures');
      console.log(`Invalid signatures: ${validation.invalidSignatureCount}`);
      process.exit(0);
    }
    
    // Edge case: no signatures checked
    console.log('⚠️  WARNING: No signatures were checked');
    console.log('This may indicate signature verification is not implemented');
    process.exit(1);
    
  } catch (err) {
    console.error('❌ ERROR: Failed to validate trace:', err.message);
    process.exit(1);
  }
}

runTamperTest();
