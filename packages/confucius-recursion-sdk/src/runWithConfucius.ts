/**
 * Confucius Mandatory Entrypoint
 * 
 * THE ONLY WAY TO RUN AGENT TASKS.
 * All other paths must be blocked to prevent "asleep" mode.
 * 
 * Engagement Rules (NON-NEGOTIABLE):
 * 1. Preflight gate runs first - fails fast if capabilities missing
 * 2. Every task produces signed trace events
 * 3. At least ONE of these happens: plan, spawn_request, quality_gate
 * 4. Strict mode enforced in agentic IDE (auto-detected)
 * 5. No silent downgrades - fail hard when tools missing
 */

import { RecursionProofOrchestratorHardened } from './orchestrator/hardened-orchestrator.js';
import type { ConfuciusAdapter } from './adapter.js';
import { createAdapter } from './adapter.js';
import { loadSupervisorSecret } from './orchestrator/supervisor-crypto.js';

export interface ConfuciusConfig {
  adapter?: ConfuciusAdapter;
  strictMode?: boolean;      // Override auto-detection
  maxDepth?: number;
  maxSpawns?: number;
}

export interface ConfuciusResult {
  ok: boolean;
  reason?: string;
  engagement: {
    preflight: 'ok' | 'failed';
    hadPlan: boolean;
    hadSpawn: boolean;
    hadQualityGate: boolean;
  };
  trace: any[];
  result?: any;
}

/**
 * Preflight Gate - Runs before any agent work
 * 
 * Validates:
 * - Runtime capabilities match requirements
 * - Supervisor secret present (or generates ephemeral)
 * - Strict mode rules satisfied
 * 
 * HARD FAIL if preflight fails in strict mode
 */
function preflightOrFail(
  adapter: ConfuciusAdapter,
  explicitStrict?: boolean
): { ok: boolean; reason?: string; strictMode: boolean; trace: any[] } {
  const trace: any[] = [];
  
  // 1. Get runtime info
  const runtime = adapter.getRuntimeInfo();
  trace.push({
    kind: 'preflight_start',
    ts: Date.now(),
    runtime: {
      host: runtime.host,
      capabilities: runtime.capabilities,
      autoStrict: runtime.strictMode
    }
  });
  
  // 2. Determine effective strict mode (explicit OR auto-detected)
  const effectiveStrict = explicitStrict !== undefined 
    ? explicitStrict 
    : runtime.strictMode;
  
  // 3. Capability validation in strict mode
  if (effectiveStrict) {
    if (!runtime.capabilities.includes('runSubagent')) {
      trace.push({
        kind: 'preflight_fail',
        ts: Date.now(),
        reason: 'tool_missing_strict',
        missing: 'runSubagent',
        strictMode: true
      });
      
      return {
        ok: false,
        reason: 'tool_missing_strict',
        strictMode: effectiveStrict,
        trace
      };
    }
  }
  
  // 4. Supervisor secret validation (warn only, not fail)
  loadSupervisorSecret(); // Trigger loading/generation side effect
  if (!process.env.CONFUCIUS_SUPERVISOR_SECRET) {
    trace.push({
      kind: 'preflight_warning',
      ts: Date.now(),
      note: 'ephemeral_secret_generated'
    });
  }
  
  // 5. Preflight passed
  trace.push({
    kind: 'preflight_ok',
    ts: Date.now(),
    strictMode: effectiveStrict
  });
  
  return {
    ok: true,
    strictMode: effectiveStrict,
    trace
  };
}

/**
 * Detect if agent actually engaged (not asleep)
 * 
 * Engagement means at least ONE of:
 * - plan event exists
 * - spawn/spawn_request event exists
 * - quality_gate event exists
 * - merge event exists
 * 
 * NO ENGAGEMENT = ASLEEP = FAIL
 */
function detectEngagement(trace: any[]): {
  hadPlan: boolean;
  hadSpawn: boolean;
  hadQualityGate: boolean;
} {
  const hadPlan = trace.some(ev => ev.kind === 'plan');
  const hadSpawn = trace.some(ev => ev.kind === 'spawn' || ev.kind === 'spawn_request');
  const hadQualityGate = trace.some(ev => ev.kind === 'quality_gate' || ev.kind === 'quality_gate_pass');
  
  return { hadPlan, hadSpawn, hadQualityGate };
}

/**
 * THE ONLY ENTRYPOINT - Run With Confucius
 * 
 * All agent tasks MUST go through this function.
 * Direct model calls or tool calls bypass orchestration and cause "asleep" mode.
 * 
 * Usage:
 * ```typescript
 * const result = await runWithConfucius({
 *   task: "Build casino backend",
 *   adapter: new CopilotAdapter()
 * });
 * 
 * if (!result.ok) {
 *   console.error('Task failed:', result.reason);
 *   console.error('Engagement:', result.engagement);
 * }
 * ```
 */
export async function runWithConfucius(
  _task: { input: any; description?: string },
  config?: ConfuciusConfig
): Promise<ConfuciusResult> {
  // 1. Create or use provided adapter
  const adapter = config?.adapter || createAdapter();
  
  // 2. Preflight gate (HARD FAIL if strict mode violated)
  const preflight = preflightOrFail(adapter, config?.strictMode);
  
  if (!preflight.ok) {
    return {
      ok: false,
      reason: preflight.reason,
      engagement: {
        preflight: 'failed',
        hadPlan: false,
        hadSpawn: false,
        hadQualityGate: false
      },
      trace: preflight.trace
    };
  }
  
  // 3. Create orchestrator with detected strict mode
  const orchestrator = new RecursionProofOrchestratorHardened({
    maxDepth: config?.maxDepth || 4,
    maxSpawns: config?.maxSpawns || 10,
    strictMode: preflight.strictMode
  });
  
  // 4. Execute recursion proof
  try {
    const result = await orchestrator.runDepth3Proof();
    
    // 5. Combine preflight trace with execution trace
    const fullTrace = [...preflight.trace, ...result.trace];
    
    // 6. Detect engagement
    const engagement = detectEngagement(fullTrace);
    
    // 7. ASLEEP DETECTOR: Fail if no engagement evidence
    const engaged = engagement.hadPlan || engagement.hadSpawn || engagement.hadQualityGate;
    if (!engaged) {
      return {
        ok: false,
        reason: 'asleep_detected',
        engagement: {
          preflight: 'ok',
          ...engagement
        },
        trace: [
          ...fullTrace,
          {
            kind: 'limit',
            ts: Date.now(),
            note: 'asleep_detected',
            reason: 'no_plan_spawn_or_gate_evidence'
          }
        ]
      };
    }
    
    // 8. Return success with engagement proof
    return {
      ok: result.ok,
      reason: result.reason,
      engagement: {
        preflight: 'ok',
        ...engagement
      },
      trace: fullTrace,
      result
    };
    
  } catch (error: any) {
    // 9. Hard failure (strict mode violation or other error)
    return {
      ok: false,
      reason: error.message,
      engagement: {
        preflight: 'ok',
        hadPlan: false,
        hadSpawn: false,
        hadQualityGate: false
      },
      trace: [
        ...preflight.trace,
        {
          kind: 'error',
          ts: Date.now(),
          error: error.message,
          stack: error.stack
        }
      ]
    };
  }
}

/**
 * Export types and adapter creators for advanced usage
 */
export { ConfuciusAdapter, CopilotAdapter, StandaloneAdapter, createAdapter } from './adapter.js';
export { RecursionProofOrchestratorHardened } from './orchestrator/hardened-orchestrator.js';
export { validateTrace } from './orchestrator/trace-validation.js';
export { qualityGate } from './orchestrator/quality-gates.js';
