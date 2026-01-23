/**
 * Depth 3 Strict Mode Test
 * 
 * Tests that strict mode correctly REJECTS execution when runSubagent tool is missing.
 * Validates no silent downgrade to simulation mode.
 */

import { describe, it, expect } from 'vitest';
import { RecursionProofOrchestratorHardened } from '../src/index.js';

describe('Depth3 Strict Mode Test', () => {
  it('should reject execution in strict mode without runSubagent tool', async () => {
    const orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: true // ENFORCE: no fallback
    });

    // Should throw on first spawn attempt
    await expect(orchestrator.runDepth3Proof()).rejects.toThrow(
      /STRICT MODE.*runSubagent.*not available/i
    );
  });

  it('should NOT record simulation warning in strict mode', async () => {
    const orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: true
    });

    try {
      await orchestrator.runDepth3Proof();
      // Should not reach here
      expect(true).toBe(false);
    } catch (error) {
      // Expected error
      expect(error.message).toMatch(/STRICT MODE/i);
    }

    // Verify trace does NOT contain simulation_warning
    const trace = orchestrator.trace.export();
    const simulationWarnings = trace.filter((ev: any) => 
      ev.note === 'simulation_warning'
    );
    
    expect(simulationWarnings).toHaveLength(0);
  });

  it('should record tool_missing_strict event in trace', async () => {
    const orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: true
    });

    try {
      await orchestrator.runDepth3Proof();
    } catch (error) {
      // Expected error
    }

    const trace = orchestrator.trace.export();
    const toolMissingEvents = trace.filter((ev: any) => 
      ev.note === 'tool_missing_strict'
    );
    
    expect(toolMissingEvents.length).toBeGreaterThan(0);
  });

  it('should set strictMode flag in proof result', () => {
    const orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: true
    });

    expect(orchestrator.strictMode).toBe(true);
  });

  it('should allow non-strict mode to use simulation', async () => {
    const orchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false // Allow simulation fallback
    });

    const result = await orchestrator.runDepth3Proof();

    expect(result.ok).toBe(true);
    expect(result.runtimeMode).toBe('simulated');
    expect(result.strictMode).toBe(false);
  });

  it('should differentiate between simulation and strict mode in trace', async () => {
    // Run both modes and compare traces
    const simOrchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: false
    });

    const strictOrchestrator = new RecursionProofOrchestratorHardened({
      maxDepth: 4,
      maxSpawns: 10,
      strictMode: true
    });

    const simResult = await simOrchestrator.runDepth3Proof();
    
    let strictError = null;
    try {
      await strictOrchestrator.runDepth3Proof();
    } catch (e) {
      strictError = e;
    }

    // Simulation should succeed with warning
    expect(simResult.ok).toBe(true);
    expect(simResult.runtimeMode).toBe('simulated');
    
    const simTrace = simResult.trace;
    const hasSimWarning = simTrace.some((ev: any) => ev.note === 'simulation_warning');
    expect(hasSimWarning).toBe(true);

    // Strict should fail immediately
    expect(strictError).toBeTruthy();
    expect(strictError.message).toMatch(/STRICT MODE/i);
    
    const strictTrace = strictOrchestrator.trace.export();
    const hasToolMissing = strictTrace.some((ev: any) => ev.note === 'tool_missing_strict');
    expect(hasToolMissing).toBe(true);
  });
});
