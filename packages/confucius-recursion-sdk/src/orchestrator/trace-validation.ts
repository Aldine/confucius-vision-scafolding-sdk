/**
 * Trace Validation
 * 
 * Verifies trace integrity by checking:
 * - Supervisor signatures on all events
 * - Run IDs exist in registry
 * - Output hashes match between registry and trace
 */

import { verifyEventSig } from './supervisor-crypto.js';
import type { SupervisorRunRegistry } from './supervisor-registry.js';
import type { TraceEvent } from './signed-trace.js';

export interface ValidationError {
  eventId: number;
  reason: string;
  kind?: string;
  childRunId?: string;
  expected?: string;
  actual?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
  eventsChecked: number;
}

export function validateTrace({
  supervisorSecret,
  traceEvents,
  registry
}: {
  supervisorSecret: Buffer;
  traceEvents: TraceEvent[];
  registry: SupervisorRunRegistry;
}): ValidationResult {
  const errors: ValidationError[] = [];

  for (const ev of traceEvents) {
    // Reconstruct canonical payload (without supervisorSig)
    const payload = {
      eventId: ev.eventId,
      ts: ev.ts,
      kind: ev.kind,
      depth: ev.depth,
      agentName: ev.agentName,
      parentRunId: ev.parentRunId || null,
      childRunId: ev.childRunId || null,
      inputHash: ev.inputHash || null,
      outputHash: ev.outputHash || null,
      note: ev.note || null
    };

    // Verify signature
    const okSig = verifyEventSig(supervisorSecret, payload, ev.supervisorSig);
    if (!okSig) {
      errors.push({
        eventId: ev.eventId,
        reason: 'bad_signature',
        kind: ev.kind
      });
    }

    // Verify child run exists in registry
    if (ev.childRunId && !registry.hasRun(ev.childRunId)) {
      errors.push({
        eventId: ev.eventId,
        reason: 'child_run_missing_in_registry',
        childRunId: ev.childRunId
      });
    }

    // Verify output hash matches registry on return events
    if (ev.kind === 'return' && ev.childRunId) {
      const rec = registry.getRun(ev.childRunId);
      if (rec && rec.outputHash && ev.outputHash && rec.outputHash !== ev.outputHash) {
        errors.push({
          eventId: ev.eventId,
          reason: 'output_hash_mismatch',
          childRunId: ev.childRunId,
          expected: rec.outputHash,
          actual: ev.outputHash
        });
      }
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    eventsChecked: traceEvents.length
  };
}
