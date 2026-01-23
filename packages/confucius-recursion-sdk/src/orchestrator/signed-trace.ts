/**
 * Signed Trace Recorder
 * 
 * Records trace events with supervisor signatures.
 * Prevents agents from forging trace events.
 */

import { sha256Hex, signEvent, stableStringify } from './supervisor-crypto.js';

export interface TraceEvent {
  eventId: number;
  ts: number;
  kind: string;
  depth: number;
  agentName: string;
  parentRunId: string | null;
  childRunId: string | null;
  inputHash: string | null;
  outputHash: string | null;
  note: string | null;
  supervisorSig: string;
}

export interface UnsignedEvent {
  kind: string;
  depth: number;
  agentName: string;
  parentRunId?: string | null;
  childRunId?: string | null;
  inputHash?: string | null;
  outputHash?: string | null;
  note?: string | null;
}

export interface TraceStats {
  totalEvents: number;
  byKind: Record<string, number>;
  deepestDepth: number;
}

export class SignedTrace {
  private secret: Buffer;
  private events: TraceEvent[];
  private eventSeq: number;

  constructor({ supervisorSecret }: { supervisorSecret: Buffer }) {
    this.secret = supervisorSecret;
    this.events = [];
    this.eventSeq = 0;
  }

  /**
   * Add signed event to trace
   * 
   * Supervisor constructs canonical payload and signs it.
   * Agents cannot provide runId, inputHash, outputHash, or supervisorSig.
   */
  addEvent(unsigned: UnsignedEvent): TraceEvent {
    this.eventSeq += 1;

    const payload = {
      eventId: this.eventSeq,
      ts: Date.now(),
      kind: unsigned.kind,
      depth: unsigned.depth,
      agentName: unsigned.agentName,
      parentRunId: unsigned.parentRunId || null,
      childRunId: unsigned.childRunId || null,
      inputHash: unsigned.inputHash || null,
      outputHash: unsigned.outputHash || null,
      note: unsigned.note || null
    };

    const supervisorSig = signEvent(this.secret, payload);

    const signed: TraceEvent = { ...payload, supervisorSig };
    this.events.push(signed);
    
    return signed;
  }

  /**
   * Export all trace events
   */
  export(): TraceEvent[] {
    return this.events.slice();
  }

  /**
   * Generate deterministic hash of object
   */
  hashOf(obj: any): string {
    return sha256Hex(stableStringify(obj));
  }

  /**
   * Get trace statistics
   */
  getStats(): TraceStats {
    const byKind: Record<string, number> = {};
    for (const ev of this.events) {
      byKind[ev.kind] = (byKind[ev.kind] || 0) + 1;
    }
    
    return {
      totalEvents: this.events.length,
      byKind,
      deepestDepth: Math.max(0, ...this.events.map(e => e.depth || 0))
    };
  }
}
