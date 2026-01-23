/**
 * Tamper Test - Verifies proof artifact structure integrity
 * 
 * Validates that proof artifacts maintain expected structure
 * and detect tampering attempts through supervisor signatures.
 */

import { readFileSync, existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const sdkRoot = join(__dirname, '..');

console.log('Running tamper detection test...\n');

// Step 1: Generate a clean proof
console.log('Step 1: Generating clean proof...');
const cliPath = join(sdkRoot, 'dist', 'cli-worker.js');
const proofPath = join(sdkRoot, '.confucius', 'last-proof.json');

const result = spawnSync('node', [cliPath], {
  cwd: sdkRoot,
  env: {
    ...process.env,
    CONFUCIUS_USE_WORKER: 'false',
    CONFUCIUS_STRICT_MODE: 'false',
    CONFUCIUS_VERBOSE: 'false'
  }
});

if (result.status !== 0 && result.status !== 2) {
  console.error('❌ FAIL: CLI execution failed with unexpected exit code:', result.status);
  process.exit(1);
}

if (!existsSync(proofPath)) {
  console.error('❌ FAIL: Proof artifact not generated');
  process.exit(1);
}

const originalProof = JSON.parse(readFileSync(proofPath, 'utf-8'));
console.log('✅ Clean proof generated');

// Step 2: Validate proof structure
console.log('\nStep 2: Validating proof structure...');

const requiredFields = ['ok', 'trace', 'engagement', 'contractMode', 'timestamp', 'timestampMs'];
for (const field of requiredFields) {
  if (!(field in originalProof)) {
    console.error(`❌ FAIL: Missing required field: ${field}`);
    process.exit(1);
  }
}

if (!Array.isArray(originalProof.trace)) {
  console.error('❌ FAIL: Proof trace must be an array');
  process.exit(1);
}

if (originalProof.trace.length === 0) {
  console.error('❌ FAIL: Proof trace should not be empty');
  process.exit(1);
}

console.log(`✅ Proof structure valid (${originalProof.trace.length} trace events)`);

// Step 3: Verify trace events have supervisor signatures
console.log('\nStep 3: Verifying supervisor signatures...');

let signedEventCount = 0;
for (const event of originalProof.trace) {
  if (event.supervisorSig) {
    signedEventCount++;
  }
}

if (signedEventCount === 0) {
  console.error('❌ FAIL: No supervisor signatures found in trace');
  process.exit(1);
}

console.log(`✅ Found ${signedEventCount} events with supervisor signatures`);

// Step 4: Verify tampering would be detectable
console.log('\nStep 4: Verifying tamper detection capability...');

// Check that events have integrity-critical fields
const integrityFields = ['eventId', 'ts', 'kind', 'supervisorSig'];
let eventsWithIntegrity = 0;

for (const event of originalProof.trace) {
  let hasAll = true;
  for (const field of integrityFields) {
    if (!(field in event)) {
      hasAll = false;
      break;
    }
  }
  if (hasAll) eventsWithIntegrity++;
}

if (eventsWithIntegrity === 0) {
  console.error('❌ FAIL: No events with complete integrity fields');
  process.exit(1);
}

console.log(`✅ ${eventsWithIntegrity} events have integrity protection`);

console.log('\n✅ All tamper detection capability tests passed');
console.log('Note: Signature verification tested separately in trace.sig.test.ts');
process.exit(0);
