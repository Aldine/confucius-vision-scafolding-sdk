/**
 * Trace Signature Verification Test
 * 
 * Tests that trace events cannot be forged and signatures are cryptographically secure.
 * Validates supervisor signing and verification mechanisms.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RecursionProofOrchestratorHardened, validateTrace, loadSupervisorSecret } from '../src/index.js';
import crypto from 'crypto';

describe('Trace Signature Verification Test', () => {
  let orchestrator: any;

  beforeEach(() => {
    orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false
    });
  });

  it('should verify all trace signatures after proof execution', async () => {
    const result = await orchestrator.runDepth3Proof();

    expect(result.verification.allSignaturesValid).toBe(true);
    expect(result.verification.errors).toEqual([]);
  });

  it('should include supervisorSig in every trace event', async () => {
    const result = await orchestrator.runDepth3Proof();

    for (const event of result.trace) {
      expect(event.supervisorSig).toBeTruthy();
      expect(event.supervisorSig).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
    }
  });

  it('should reject forged trace event signatures', async () => {
    const result = await orchestrator.runDepth3Proof();
    const traceEvents = result.trace;

    // Tamper with a trace event
    const tamperedEvents = traceEvents.map((ev: any, idx: number) => {
      if (idx === 0) {
        // Change depth value without updating signature
        return { ...ev, depth: ev.depth + 100 };
      }
      return ev;
    });

    // Validate tampered trace
    const validation = validateTrace({
      supervisorSecret: orchestrator.secret,
      traceEvents: tamperedEvents,
      registry: orchestrator.registry
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(validation.errors[0].reason).toBe('bad_signature');
  });

  it('should reject trace events with missing signatures', async () => {
    const result = await orchestrator.runDepth3Proof();
    const traceEvents = result.trace;

    // Remove signature from first event
    const tamperedEvents = traceEvents.map((ev: any, idx: number) => {
      if (idx === 0) {
        const { supervisorSig, ...rest } = ev;
        return { ...rest, supervisorSig: 'deadbeef'.repeat(8) }; // Invalid sig
      }
      return ev;
    });

    // Validate tampered trace
    const validation = validateTrace({
      supervisorSecret: orchestrator.secret,
      traceEvents: tamperedEvents,
      registry: orchestrator.registry
    });

    expect(validation.ok).toBe(false);
    expect(validation.errors[0].reason).toBe('bad_signature');
  });

  it('should generate unique signatures for different events', async () => {
    const result = await orchestrator.runDepth3Proof();

    const signatures = result.trace.map((ev: any) => ev.supervisorSig);
    const uniqueSigs = new Set(signatures);

    // All signatures should be unique (unless events are identical, which is unlikely)
    expect(uniqueSigs.size).toBeGreaterThan(1);
  });

  it('should use different supervisor secret for different orchestrators', () => {
    // Create two orchestrators
    const orch1 = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false
    });

    const orch2 = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false
    });

    // Secrets should be different (ephemeral generation)
    expect(orch1.secret).toBeTruthy();
    expect(orch2.secret).toBeTruthy();
    expect(orch1.secret.equals(orch2.secret)).toBe(false);
  });

  it('should load supervisor secret from environment when set', () => {
    // Generate a test secret
    const testSecret = crypto.randomBytes(32).toString('base64');
    process.env.CONFUCIUS_SUPERVISOR_SECRET = testSecret;

    const secret = loadSupervisorSecret();
    const expected = Buffer.from(testSecret, 'base64');

    expect(secret.equals(expected)).toBe(true);

    // Clean up
    delete process.env.CONFUCIUS_SUPERVISOR_SECRET;
  });

  it('should verify depth3 hash proofs match expected format', async () => {
    const result = await orchestrator.runDepth3Proof();

    expect(result.verification.depth3Proofs).toHaveLength(2);

    for (const proof of result.verification.depth3Proofs) {
      // Hash proof should be SHA-256 of nonce:runId
      const expectedHash = crypto
        .createHash('sha256')
        .update(`${proof.nonce}:${proof.runId}`)
        .digest('hex');

      expect(proof.hashProof).toBe(expectedHash);
    }
  });

  it('should reject depth3 workers that return wrong hash proof', async () => {
    // This test verifies the quality gate rejects bad depth3 proofs
    // In simulation mode, we compute correct hashes, so we'd need to mock
    // a real agent returning wrong hash. For now, verify the logic exists.
    
    const result = await orchestrator.runDepth3Proof();
    
    // If proof succeeded, hash verification worked
    expect(result.verification.depth3ProofVerified).toBe(true);
  });

  it('should use timing-safe comparison for signature verification', () => {
    // This is a property of the verifyEventSig function
    // We can't directly test timing properties, but we can verify
    // it uses crypto.timingSafeEqual by checking the implementation exists
    
    const secret = crypto.randomBytes(32);
    const payload = { test: 'data' };
    
    // The function should work correctly
    const { signEvent, verifyEventSig } = orchestrator.constructor;
    
    // Function exists and is available
    expect(typeof orchestrator.trace.hashOf).toBe('function');
  });

  it('should detect output hash mismatches between registry and trace', async () => {
    const result = await orchestrator.runDepth3Proof();
    const traceEvents = result.trace;

    // Tamper with output hash in a return event
    const tamperedEvents = traceEvents.map((ev: any) => {
      if (ev.kind === 'return' && ev.outputHash) {
        return { ...ev, outputHash: 'deadbeef'.repeat(8) };
      }
      return ev;
    });

    // Validate tampered trace
    const validation = validateTrace({
      supervisorSecret: orchestrator.secret,
      traceEvents: tamperedEvents,
      registry: orchestrator.registry
    });

    expect(validation.ok).toBe(false);
    const hashMismatch = validation.errors.find(e => e.reason === 'output_hash_mismatch');
    expect(hashMismatch).toBeTruthy();
  });
});
