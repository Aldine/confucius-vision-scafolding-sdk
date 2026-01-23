#!/usr/bin/env node

/**
 * Step 5: Asleep Detector - Minimal Proof of Concept
 * 
 * This demonstrates that we CAN detect when Confucius is engaged vs asleep
 * by checking for specific trace events that indicate orchestration work.
 */

// Simulate a trace with engagement evidence
function createEngagedTrace() {
  return {
    events: [
      { kind: 'preflight_ok', note: 'Capabilities validated' },
      { kind: 'plan_created', note: 'Planning phase completed' },
      { kind: 'spawn', agentName: 'depth1_orchestrator' },
      { kind: 'spawn_request_detected', note: 'Found spawn request in output' },
      { kind: 'quality_gate_pass', note: 'Output validation succeeded' },
      { kind: 'return', agentName: 'depth1_orchestrator' }
    ]
  };
}

// Simulate a trace WITHOUT engagement (asleep mode)
function createAsleepTrace() {
  return {
    events: [
      // Only basic events, no orchestration evidence
      { kind: 'limit', note: 'No work performed' }
    ]
  };
}

// Asleep detector contract - checks for 4 required conditions
function asleepDetector(trace) {
  const events = trace?.events || [];
  
  const hasPreflightOk = events.some(e => e.kind === 'preflight_ok');
  const hasPlanCreated = events.some(e => e.kind === 'plan_created');
  const hasEngagement = events.some(e => 
    e.kind === 'spawn' ||
    e.kind === 'spawn_request_detected' ||
    e.kind === 'merge' ||
    e.kind === 'quality_gate_pass'
  );
  const allSignaturesValid = true; // Simplified for POC
  
  const ok = hasPreflightOk && hasPlanCreated && hasEngagement && allSignaturesValid;
  
  return {
    ok,
    conditions: {
      preflight_ok: hasPreflightOk,
      plan_created: hasPlanCreated,
      engagement: hasEngagement,
      verification: allSignaturesValid
    },
    evidence: events.map(e => ({
      kind: e.kind,
      agentName: e.agentName,
      note: e.note
    }))
  };
}

// Main test harness
function main() {
  const forceSleep = process.env.CONFUCIUS_FORCE_SLEEP === 'true';
  
  console.log('='.repeat(60));
  console.log('STEP 5: ASLEEP DETECTOR TEST');
  console.log('='.repeat(60));
  console.log(`Mode: ${forceSleep ? 'FORCED SLEEP' : 'NORMAL'}`);
  console.log();
  
  // Create appropriate trace based on mode
  const trace = forceSleep ? createAsleepTrace() : createEngagedTrace();
  
  // Run asleep detector
  const result = asleepDetector(trace);
  
  // Display results
  console.log('Asleep Detector Results:');
  console.log('  Overall:', result.ok ? '✓ ENGAGED' : '✗ ASLEEP');
  console.log('  Conditions:');
  console.log('    preflight_ok:', result.conditions.preflight_ok ? '✓' : '✗');
  console.log('    plan_created:', result.conditions.plan_created ? '✓' : '✗');
  console.log('    engagement:', result.conditions.engagement ? '✓' : '✗');
  console.log('    verification:', result.conditions.verification ? '✓' : '✗');
  console.log();
  console.log('Trace Evidence:', result.evidence.length, 'events');
  result.evidence.forEach(e => {
    console.log(`  - ${e.kind}${e.agentName ? ` (${e.agentName})` : ''}${e.note ? `: ${e.note}` : ''}`);
  });
  console.log();
  
  // Exit with appropriate code
  if (!result.ok) {
    console.log('EXIT CODE 5: ASLEEP_DETECTED');
    console.log('Confucius never engaged. No orchestration work was performed.');
    process.exit(5);
  } else {
    console.log('EXIT CODE 0: SUCCESS');
    console.log('Confucius is engaged and performing orchestration work.');
    process.exit(0);
  }
}

main();
