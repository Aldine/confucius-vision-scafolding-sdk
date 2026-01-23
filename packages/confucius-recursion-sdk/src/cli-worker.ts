#!/usr/bin/env node

/**
 * CLI Worker Mode - Orchestration runs in worker thread
 * 
 * Usage:
 *   CONFUCIUS_USE_WORKER=true node dist/cli-worker.js
 *   CONFUCIUS_FORCE_SLEEP=true node dist/cli-worker.js
 */

import { CopilotAdapter, StandaloneAdapter } from './adapter.js';
import { runWithWorker } from './worker/worker-manager.js';
import { asleepDetector } from './asleep-detector.js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

function getBoolEnv(name: string, fallback: boolean): boolean {
  const val = process.env[name];
  if (val === undefined) return fallback;
  return val === 'true' || val === '1';
}

function writeProofArtifact(proof: Record<string, any>): void {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const proofDir = resolve(__dirname, '..', '.confucius');
    const proofPath = resolve(proofDir, 'last-proof.json');
    
    // Add trace marker and canonical timestamp for artifact write
    const proofWithMarker = {
      ...proof,
      timestampMs: Date.now(), // Canonical timestamp field
      traceMarker: 'proof_written',
      proofPath
    };
    
    mkdirSync(proofDir, { recursive: true });
    writeFileSync(proofPath, JSON.stringify(proofWithMarker, null, 2), 'utf-8');
  } catch (err) {
    // Non-fatal - don't crash if we can't write artifact
    console.error('Warning: Failed to write proof artifact:', err);
  }
}

async function main() {
  const strictMode = getBoolEnv('CONFUCIUS_STRICT_MODE', false);
  const forceSleep = getBoolEnv('CONFUCIUS_FORCE_SLEEP', false);
  const verbose = getBoolEnv('CONFUCIUS_VERBOSE', false);
  
  console.log('⚙️  Worker Mode: Orchestration runs off main thread');
  console.log('='.repeat(60));
  console.log(`Strict: ${strictMode}, Force Sleep: ${forceSleep}`);
  console.log();
  
  // Detect adapter
  const hasRunSubagent = typeof (globalThis as any).runSubagent !== 'undefined';
  const adapter: CopilotAdapter | StandaloneAdapter = hasRunSubagent
    ? new CopilotAdapter()
    : new StandaloneAdapter();
  
  if (verbose) {
    console.log('Adapter:', adapter.constructor.name);
    console.log('Runtime:', adapter.getRuntimeInfo());
    console.log();
  }
  
  // Task
  const task = process.env.CONFUCIUS_TASK ||
    'Implement dark mode contrast audit and return patch plus verification';
  
  // Gate: Worker mode requires runSubagent
  const canUseWorker = typeof (adapter as any).runSubagent === 'function';
  
  if (!canUseWorker) {
    if (strictMode) {
      // Strict mode requires real tooling
      const output = {
        ok: false,
        reason: 'tool_missing_strict',
        error: 'Worker mode requires runSubagent but adapter lacks it. Cannot proceed in strict mode.'
      };
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      process.exit(2);
    } else {
      // Fall back to non-worker simulated mode
      console.log('⚠️  Worker disabled: runSubagent not available');
      console.log('Falling back to non-worker simulation mode');
      console.log();
      
      const { RecursionProofOrchestratorHardened } = await import('./orchestrator/hardened-orchestrator.js');
      const orch = new RecursionProofOrchestratorHardened({
        maxDepth: 4,
        maxSpawns: 10,
        strictMode,
        forceSleep,
        simulateWhenNoAdapter: true,
        spawnAdapter: undefined,
        verbose
      });
      
      const orchResult = await orch.runDepth3Proof();
      const sleep = asleepDetector(orchResult, strictMode);
      
      const contractMode = strictMode ? 'agentic' : 'local';
      const proofOk = orchResult.ok === true;
      let contractOk = sleep.ok;
      
      // FORCE_SLEEP overrides everything - always fail
      if (forceSleep) {
        contractOk = false;
      }
      
      const output = {
        ok: contractOk && proofOk,
        runtimeMode: 'simulated',
        strictMode,
        forceSleep,
        workerMode: false,
        contractMode,
        warning: 'worker_disabled_no_runSubagent',
        asleepDetector: sleep,
        engagement: sleep.engagement,
        verification: orchResult.verification || null,
        deepestDepthReached: orchResult.deepestDepthReached || 0,
        spawnsExecuted: orchResult.spawnsExecuted || 0,
        trace: orchResult.trace || [],
        timestamp: new Date().toISOString()
      };
      
      // Write proof artifact
      writeProofArtifact(output);
      
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      
      // Exit logic for local mode
      // FORCE_SLEEP always exits 5
      if (forceSleep) {
        if (verbose) {
          console.error('\n🛌 FORCE_SLEEP enabled - Exit code 5');
        }
        process.exit(5);
      }
      
      if (!contractOk) {
        process.exit(5); // Asleep
      }
      if (!proofOk) {
        process.exit(1); // Proof failed
      }
      process.exit(0); // Success
    }
  }
  
  try {
    // Run in worker
    const result = await runWithWorker(task, {
      adapter,
      strictMode,
      forceSleep,
      verbose,
      maxDepth: 4,
      maxSpawns: 10
    });
    
    if (!result.ok) {
      console.error('Worker failed:', result.reason);
      if (result.error) {
        console.error('Error:', result.error);
      }
      
      const output = {
        ok: false,
        reason: result.reason || 'cli_crash',
        error: result.error
      };
      
      process.stdout.write(JSON.stringify(output, null, 2) + '\n');
      process.exit(2);
    }
    
    // Check for asleep
    const workerResult = result.result as Record<string, any> | undefined;
    const sleep = asleepDetector(workerResult, strictMode);
    
    const contractMode = strictMode ? 'agentic' : 'local';
    const proofOk = workerResult?.ok === true;
    let contractOk = sleep.ok;
    
    // FORCE_SLEEP overrides everything - always fail
    if (forceSleep) {
      contractOk = false;
    }
    
    const output = {
      ok: contractOk && proofOk,
      runtimeMode: workerResult?.runtimeMode || 'unknown',
      strictMode,
      forceSleep,
      workerMode: true,
      contractMode,
      asleepDetector: sleep,
      engagement: sleep.engagement,
      verification: workerResult?.verification || null,
      deepestDepthReached: workerResult?.deepestDepthReached || 0,
      spawnsExecuted: workerResult?.spawnsExecuted || 0,
      trace: workerResult?.trace || [],
      timestamp: new Date().toISOString()
    };
    
    // Write proof artifact
    writeProofArtifact(output);
    
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    
    // Exit logic
    // FORCE_SLEEP always exits 5 (highest priority)
    if (forceSleep) {
      if (verbose) {
        console.error('\n🛌 FORCE_SLEEP enabled - Exit code 5');
      }
      process.exit(5);
    }
    
    // Strict mode + not real runtime = tool missing
    if (strictMode && output.runtimeMode !== 'real') {
      if (verbose) {
        console.error('\n⚠️  STRICT MODE: Runtime not real - Exit code 2');
      }
      process.exit(2);
    }
    
    // Contract violated (asleep)
    if (!contractOk) {
      if (verbose) {
        console.error('\n🛌 CONTRACT VIOLATED (asleep) - Exit code 5');
      }
      process.exit(5);
    }
    
    // Proof failed
    if (!proofOk) {
      if (verbose) {
        console.error('\n❌ PROOF FAILED - Exit code 1');
      }
      process.exit(1);
    }
    
    // Success
    if (verbose) {
      console.log('\n✅ SUCCESS - Exit code 0');
    }
    process.exit(0);
    
  } catch (error) {
    console.error('CLI crashed:', error);
    
    const output = {
      ok: false,
      reason: 'cli_crash',
      error: error instanceof Error ? error.message : String(error)
    };
    
    process.stdout.write(JSON.stringify(output, null, 2) + '\n');
    process.exit(2);
  }
}

main();


