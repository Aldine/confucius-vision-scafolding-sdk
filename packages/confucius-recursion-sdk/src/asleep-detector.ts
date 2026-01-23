/**
 * Asleep Detector - Verifies engagement evidence in proof results
 * 
 * Two modes:
 * - Strict mode (agentic IDE): Requires full engagement (preflight, plan, spawn, verification)
 * - Local mode (dev): Requires minimal engagement (trace exists, some activity)
 */

function hasAnyKind(trace: any[], kinds: string[]): boolean {
  return trace.some((t: any) => kinds.includes(t?.kind));
}

export interface EngagementFlags {
  hasPreflightOk: boolean;
  hasPlanCreated: boolean;
  hasProofVerified: boolean;
  hasSpawnOrRequest: boolean;
  hasQualityGatePass: boolean;
}

export interface AsleepDetectorResult {
  ok: boolean;
  traceCount: number;
  verificationOk: boolean;
  engagement: EngagementFlags;
  traceEvents: string[];
  contractMode: 'agentic' | 'local';
  contractSatisfied: boolean;
}

export function asleepDetector(result: unknown, strictMode: boolean = false): AsleepDetectorResult {
  const trace = Array.isArray((result as any)?.trace) ? (result as any).trace : [];
  const verificationOk = (result as any)?.verification?.allSignaturesValid === true;
  const runtimeMode = (result as any)?.runtimeMode || 'unknown';

  // Engagement flags
  const hasPreflightOk = hasAnyKind(trace, ["preflight_ok"]);
  const hasPlanCreated = hasAnyKind(trace, ["plan_created"]);
  const hasProofVerified = verificationOk && trace.length > 0;
  const hasSpawnOrRequest = hasAnyKind(trace, ["spawn", "spawn_request_detected", "supervisor_spawn"]);
  const hasQualityGatePass = hasAnyKind(trace, ["quality_gate_pass"]);

  const engagement: EngagementFlags = {
    hasPreflightOk,
    hasPlanCreated,
    hasProofVerified,
    hasSpawnOrRequest,
    hasQualityGatePass
  };

  const contractMode = strictMode ? 'agentic' : 'local';

  let contractSatisfied: boolean;

  if (strictMode) {
    // Agentic mode: strict requirements
    contractSatisfied = 
      hasPreflightOk &&
      hasPlanCreated &&
      hasSpawnOrRequest &&
      verificationOk &&
      runtimeMode === 'real';
  } else {
    // Local mode: minimal requirements
    const hasMinimalActivity = 
      hasSpawnOrRequest ||
      hasAnyKind(trace, ["merge", "return"]) ||
      hasQualityGatePass;
    
    contractSatisfied = 
      trace.length > 0 &&
      hasMinimalActivity;
  }

  return {
    ok: contractSatisfied,
    traceCount: trace.length,
    verificationOk,
    engagement,
    traceEvents: trace.map((t: any) => t?.kind).filter(Boolean),
    contractMode,
    contractSatisfied
  };
}
