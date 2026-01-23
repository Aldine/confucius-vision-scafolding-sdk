/**
 * Simple smoke test for asleep detection
 * Tests that we can detect engagement vs non-engagement
 */

import { RecursionProofOrchestratorHardened } from '../dist/index.js';

console.log('✓ Import successful');

// Test 1: Check that orchestrator can be instantiated
try {
  const orch = new RecursionProofOrchestratorHardened({
    maxDepth: 2,
    maxSpawns: 5,
    strictMode: false,
    forceSleep: false
  });
  console.log('✓ Orchestrator instantiated');
} catch (err) {
  console.error('✗ Failed to instantiate:', err.message);
  process.exit(1);
}

// Test 2: Check trace events are available
try {
  const orch = new RecursionProofOrchestratorHardened({
    maxDepth: 2,
    maxSpawns: 5,
    strictMode: false
  });
  
  // Run a minimal proof
  const result = await orch.runDepth3Proof();
  
  console.log('Result keys:', Object.keys(result || {}));
  console.log('Runtime mode:', result?.runtimeMode);
  console.log('Trace events:', result?.trace?.events?.length || 0);
  
  // Check for engagement evidence
  const events = result?.trace?.events || [];
  const hasPreflightOk = events.some(e => e.kind === 'preflight_ok');
  const hasPlanCreated = events.some(e => e.kind === 'plan_created');
  const hasSpawnRequest = events.some(e => e.kind === 'spawn_request_detected');
  const hasQualityGate = events.some(e => e.kind === 'quality_gate_pass');
  
  console.log('Engagement evidence:');
  console.log('  preflight_ok:', hasPreflightOk);
  console.log('  plan_created:', hasPlanCreated);
  console.log('  spawn_request_detected:', hasSpawnRequest);
  console.log('  quality_gate_pass:', hasQualityGate);
  
  if (hasPreflightOk && hasPlanCreated) {
    console.log('✓ Basic engagement detected');
    process.exit(0);
  } else {
    console.log('✗ No engagement evidence found');
    process.exit(5); // ASLEEP
  }
  
} catch (err) {
  console.error('✗ Test failed:', err.message);
  console.error(err.stack);
  process.exit(1);
}
