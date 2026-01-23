/**
 * Supervisor Run Registry
 * 
 * Mints run IDs and tracks all spawned agent runs.
 * Ensures run IDs cannot be spoofed by agents.
 */

import crypto from 'crypto';

export interface RunRecord {
  runId: string;
  parentRunId: string | null;
  agentName: string;
  depth: number;
  inputHash: string;
  outputHash: string | null;
  nonce: string | null;
  status: 'spawned' | 'returned';
  spawnedAt: number;
  returnedAt?: number;
}

export interface SpawnStats {
  totalSpawns: number;
  returned: number;
  pending: number;
  deepestDepth: number;
}

export class SupervisorRunRegistry {
  private runs: Map<string, RunRecord>;
  public totalSpawns: number;

  constructor() {
    this.runs = new Map();
    this.totalSpawns = 0;
  }

  /**
   * Mint a supervisor-controlled run ID
   * 
   * Format: {agentName}_{timestamp}_{randomHex}
   * Agents cannot forge these since they don't control minting
   */
  mintRunId(agentName: string): string {
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace('.', '');
    const rand = crypto.randomBytes(4).toString('hex');
    return `${agentName}_${ts}_${rand}`;
  }

  /**
   * Register a new spawn with input hash and optional nonce for depth3 proof
   */
  registerSpawn({
    runId,
    parentRunId,
    agentName,
    depth,
    inputHash,
    nonce = null
  }: {
    runId: string;
    parentRunId: string | null;
    agentName: string;
    depth: number;
    inputHash: string;
    nonce?: string | null;
  }): void {
    if (this.runs.has(runId)) {
      throw new Error(`Duplicate runId: ${runId}`);
    }
    
    this.totalSpawns += 1;
    
    this.runs.set(runId, {
      runId,
      parentRunId: parentRunId || null,
      agentName,
      depth,
      inputHash,
      outputHash: null,
      nonce,
      status: 'spawned',
      spawnedAt: Date.now()
    });
  }

  /**
   * Register agent return with output hash
   */
  registerReturn({ runId, outputHash }: { runId: string; outputHash: string }): void {
    const rec = this.runs.get(runId);
    if (!rec) {
      throw new Error(`Unknown runId return: ${runId}`);
    }
    
    rec.outputHash = outputHash;
    rec.status = 'returned';
    rec.returnedAt = Date.now();
  }

  /**
   * Check if run exists in registry
   */
  hasRun(runId: string): boolean {
    return this.runs.has(runId);
  }

  /**
   * Get run record by ID
   */
  getRun(runId: string): RunRecord | null {
    return this.runs.get(runId) || null;
  }

  /**
   * Get all runs as array
   */
  getAllRuns(): RunRecord[] {
    return Array.from(this.runs.values());
  }

  /**
   * Get spawn statistics
   */
  getStats(): SpawnStats {
    const runs = Array.from(this.runs.values());
    const returned = runs.filter(r => r.status === 'returned').length;
    const pending = runs.filter(r => r.status === 'spawned').length;
    
    return {
      totalSpawns: this.totalSpawns,
      returned,
      pending,
      deepestDepth: Math.max(0, ...runs.map(r => r.depth))
    };
  }
}
