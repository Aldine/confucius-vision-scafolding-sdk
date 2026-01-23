/**
 * Depth 3 Simulation Test
 * 
 * Tests the recursion proof system in simulation mode (no runSubagent tool).
 * Validates all hardening features work in standalone environment.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RecursionProofOrchestratorHardened } from '../src/index.js';

describe('Depth3 Simulation Test', () => {
  let orchestrator: any;

  beforeEach(() => {
    orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false // Allows simulation
    });
  });

  it('should complete depth3 proof in simulation mode', async () => {
    const result = await orchestrator.runDepth3Proof();

    expect(result.ok).toBe(true);
    expect(result.deepestDepthReached).toBe(3);
    expect(result.spawnsExecuted).toBeGreaterThanOrEqual(5); // depth1 + 2x depth2 + 2x depth3
    expect(result.runtimeMode).toBe('simulated');
    expect(result.strictMode).toBe(false);
  });

  it('should verify all trace signatures in simulation', async () => {
    const result = await orchestrator.runDepth3Proof();

    expect(result.verification.allSignaturesValid).toBe(true);
    expect(result.verification.errors).toEqual([]);
  });

  it('should verify depth3 proof-of-execution hashes', async () => {
    const result = await orchestrator.runDepth3Proof();

    expect(result.verification.depth3ProofVerified).toBe(true);
    expect(result.verification.depth3Proofs).toHaveLength(2);
    
    for (const proof of result.verification.depth3Proofs) {
      expect(proof.runId).toBeTruthy();
      expect(proof.nonce).toBeTruthy();
      expect(proof.hashProof).toBeTruthy();
      expect(proof.hashProof).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
    }
  });

  it('should record simulation warning in trace', async () => {
    const result = await orchestrator.runDepth3Proof();

    const simulationEvents = result.trace.filter((ev: any) => 
      ev.kind === 'limit' && ev.note === 'simulation_warning'
    );
    
    expect(simulationEvents).toHaveLength(1);
  });

  it('should respect spawn limits', async () => {
    const limitedOrchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 2, // Only allow 2 spawns
      strictMode: false
    });

    const result = await limitedOrchestrator.runDepth3Proof();

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('limit');
    expect(result.spawnsExecuted).toBeLessThanOrEqual(2);
  });

  it('should respect depth limits', async () => {
    const limitedOrchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 2, // Only allow up to depth 2
      maxSpawns: 10,
      strictMode: false
    });

    const result = await limitedOrchestrator.runDepth3Proof();

    expect(result.ok).toBe(false);
    expect(result.deepestDepthReached).toBeLessThan(3);
  });

  it('should generate unique run IDs for each spawn', async () => {
    const result = await orchestrator.runDepth3Proof();

    const spawnEvents = result.trace.filter((ev: any) => ev.kind === 'spawn');
    const runIds = spawnEvents.map((ev: any) => ev.childRunId);
    const uniqueRunIds = new Set(runIds);

    expect(runIds.length).toBeGreaterThan(0);
    expect(uniqueRunIds.size).toBe(runIds.length); // All unique
  });

  it('should record spawn and return events for each agent', async () => {
    const result = await orchestrator.runDepth3Proof();

    const spawnEvents = result.trace.filter((ev: any) => ev.kind === 'spawn');
    const returnEvents = result.trace.filter((ev: any) => ev.kind === 'return');

    expect(spawnEvents.length).toBe(returnEvents.length);
    expect(spawnEvents.length).toBeGreaterThanOrEqual(5); // depth1 + 2x depth2 + 2x depth3
  });

  it('should include merge event at end of proof', async () => {
    const result = await orchestrator.runDepth3Proof();

    const mergeEvents = result.trace.filter((ev: any) => ev.kind === 'merge');
    
    expect(mergeEvents).toHaveLength(1);
    expect(mergeEvents[0].note).toBe('merged_depth2_depth3_results');
  });
});
