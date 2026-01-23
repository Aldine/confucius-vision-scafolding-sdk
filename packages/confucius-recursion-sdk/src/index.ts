/**
 * Confucius Recursion SDK - Public API
 * 
 * MANDATORY ENTRYPOINT: runWithConfucius
 * All agent tasks must go through this function to prevent "asleep" mode.
 * 
 * Supervised recursion proof harness with:
 * - Preflight gates (capability validation)
 * - Signed trace (non-spoofable events)
 * - Quality gates (output validation with retry)
 * - Strict mode (auto-detected in agentic IDEs)
 * - Asleep detection (fails if no engagement evidence)
 */

// ============================================================================
// MANDATORY ENTRYPOINT - Use this, not direct orchestrator calls
// ============================================================================

export { runWithConfucius } from './runWithConfucius.js';
export type { ConfuciusConfig, ConfuciusResult } from './runWithConfucius.js';

// ============================================================================
// ADAPTERS - For integrating with different agentic IDE runtimes
// ============================================================================

export {
  type ConfuciusAdapter,
  CopilotAdapter,
  StandaloneAdapter,
  createAdapter
} from './adapter.js';

// ============================================================================
// ADVANCED: Direct orchestrator access (use only for debugging/testing)
// ============================================================================

export { RecursionProofOrchestratorHardened } from './orchestrator/hardened-orchestrator.js';
export { validateTrace } from './orchestrator/trace-validation.js';
export { qualityGate, runWithRetry } from './orchestrator/quality-gates.js';
export { loadSupervisorSecret } from './orchestrator/supervisor-crypto.js';

// ============================================================================
// TYPES - For TypeScript users
// ============================================================================

export type { TraceEvent } from './orchestrator/signed-trace.js';
export type { ValidationResult, ValidationError } from './orchestrator/trace-validation.js';
export type { QualityGateResult, RetryResult } from './orchestrator/quality-gates.js';
export type { RunRecord, SpawnStats } from './orchestrator/supervisor-registry.js';

// ============================================================================
// CRITICAL: Internal modules NOT exported (prevents bypass)
// ============================================================================
// - supervisor-crypto (except loadSupervisorSecret helper)
// - supervisor-registry (RunRegistry class)
// - signed-trace (SignedTrace class)
//
// These must remain internal to prevent agents from forging IDs or signatures.

// ============================================
// WORKER MODE - Isolates orchestration off main thread
// ============================================

export { runWithWorker } from './worker/worker-manager.js';
export type { 
  WorkerOrchestratorConfig, 
  WorkerOrchestratorResult 
} from './worker/worker-manager.js';
export type {
  RunTaskMessage,
  MainToWorkerMessage,
  WorkerToMainMessage
} from './worker/protocol.js';

// SpawnAdapter and SpawnResult are exported from orchestrator
export type { SpawnAdapter, SpawnResult } from './orchestrator/hardened-orchestrator.js';
