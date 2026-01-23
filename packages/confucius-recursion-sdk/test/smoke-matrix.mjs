#!/usr/bin/env node

/**
 * Smoke Matrix - Exercises all critical code paths
 * 
 * Detects orphaned code by tracking which trace markers appear in each scenario.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function runScenario(name, env) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Scenario: ${name}`);
  console.log('='.repeat(60));
  
  try {
    const result = execSync('node dist/cli-worker.js', {
      cwd: rootDir,
      encoding: 'utf-8',
      env: { ...process.env, ...env },
      stdio: 'pipe'
    });
    
    const output = JSON.parse(result);
    return {
      name,
      exitCode: 0,
      ok: output.ok,
      contractMode: output.contractMode,
      runtimeMode: output.runtimeMode,
      traceCount: output.trace?.length || 0,
      engagement: output.engagement,
      markers: extractMarkers(output)
    };
  } catch (err) {
    const exitCode = err.status || 1;
    try {
      const output = JSON.parse(err.stdout || '{}');
      return {
        name,
        exitCode,
        ok: output.ok || false,
        contractMode: output.contractMode || 'unknown',
        runtimeMode: output.runtimeMode || 'unknown',
        traceCount: output.trace?.length || 0,
        engagement: output.engagement || {},
        markers: extractMarkers(output)
      };
    } catch {
      return {
        name,
        exitCode,
        ok: false,
        error: err.stderr || err.message
      };
    }
  }
}

function extractMarkers(output) {
  const markers = [];
  
  // Trace event markers
  const traceEvents = output.trace || [];
  const eventKinds = new Set(traceEvents.map(t => t.kind));
  
  if (eventKinds.has('preflight_ok')) markers.push('preflight_ok');
  if (eventKinds.has('plan_created')) markers.push('plan_created');
  if (eventKinds.has('spawn')) markers.push('spawn');
  if (eventKinds.has('quality_gate_pass')) markers.push('quality_gate_pass');
  if (eventKinds.has('merge')) markers.push('merge');
  
  // Engagement markers
  if (output.engagement?.hasProofVerified) markers.push('proof_verified');
  if (output.engagement?.hasSpawnOrRequest) markers.push('spawn_or_request');
  
  // Contract markers
  if (output.contractMode) markers.push(`contract_${output.contractMode}`);
  if (output.runtimeMode) markers.push(`runtime_${output.runtimeMode}`);
  
  // Output markers
  if (output.ok) markers.push('output_ok');
  if (output.asleepDetector?.ok) markers.push('awake');
  if (output.asleepDetector?.ok === false) markers.push('asleep');
  
  return markers;
}

const scenarios = [
  {
    name: 'Local Simulated (Success)',
    env: {
      CONFUCIUS_STRICT_MODE: 'false',
      CONFUCIUS_USE_WORKER: 'false',
      CONFUCIUS_FORCE_SLEEP: 'false',
      CONFUCIUS_VERBOSE: 'false'
    },
    expectedMarkers: ['contract_local', 'runtime_simulated', 'spawn', 'proof_verified']
  },
  {
    name: 'Local Forced Sleep',
    env: {
      CONFUCIUS_STRICT_MODE: 'false',
      CONFUCIUS_USE_WORKER: 'false',
      CONFUCIUS_FORCE_SLEEP: 'true',
      CONFUCIUS_VERBOSE: 'false'
    },
    expectedMarkers: ['contract_local', 'runtime_simulated', 'asleep']
  },
  {
    name: 'Strict Missing Tools',
    env: {
      CONFUCIUS_STRICT_MODE: 'true',
      CONFUCIUS_USE_WORKER: 'true',
      CONFUCIUS_VERBOSE: 'false'
    },
    expectedExitCode: 2
  },
  {
    name: 'Worker Disabled (No runSubagent)',
    env: {
      CONFUCIUS_STRICT_MODE: 'false',
      CONFUCIUS_USE_WORKER: 'true',
      CONFUCIUS_VERBOSE: 'false'
    },
    expectedMarkers: ['contract_local', 'runtime_simulated']
  }
];

function runSmokeMatrix() {
  console.log('Smoke Matrix - Exercising all code paths\n');
  
  const results = [];
  const allMarkers = new Set();
  
  for (const scenario of scenarios) {
    const result = runScenario(scenario.name, scenario.env);
    results.push(result);
    
    if (result.markers) {
      result.markers.forEach(m => allMarkers.add(m));
    }
    
    console.log(`Exit Code: ${result.exitCode}`);
    console.log(`Contract Mode: ${result.contractMode}`);
    console.log(`Runtime Mode: ${result.runtimeMode}`);
    console.log(`Trace Events: ${result.traceCount}`);
    console.log(`Markers: ${result.markers ? result.markers.join(', ') : 'none'}`);
    
    // Check expected conditions
    if (scenario.expectedExitCode !== undefined) {
      const match = result.exitCode === scenario.expectedExitCode;
      console.log(`Expected Exit Code ${scenario.expectedExitCode}: ${match ? '✅' : '❌'}`);
    }
    
    if (scenario.expectedMarkers) {
      const missing = scenario.expectedMarkers.filter(m => !result.markers || !result.markers.includes(m));
      if (missing.length > 0) {
        console.log(`Missing Expected Markers: ${missing.join(', ')} ❌`);
      } else {
        console.log('All Expected Markers Present: ✅');
      }
    }
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('Summary: All Observed Markers');
  console.log('='.repeat(60));
  console.log(Array.from(allMarkers).sort().join('\n'));
  
  console.log(`\nTotal scenarios: ${scenarios.length}`);
  console.log(`Unique markers observed: ${allMarkers.size}`);
}

runSmokeMatrix();
