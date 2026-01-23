/**
 * Depth 3 Fan-Out Harness
 * 
 * Proves recursion scales beyond depth 2 with supervised spawning:
 * - Main (depth 0) spawns depth1 orchestrator
 * - Depth1 requests 2 workers at depth2
 * - Each depth2 requests 1 micro worker at depth3
 * - Supervisor validates, executes, and signs all spawns
 * - Depth3 workers provide nonce-based proof-of-execution
 */

import crypto from 'crypto';
import { loadSupervisorSecret, sha256Hex } from './supervisor-crypto.js';
import { SupervisorRunRegistry } from './supervisor-registry.js';
import { SignedTrace } from './signed-trace.js';
import { validateTrace } from './trace-validation.js';
import { qualityGate, runWithRetry, QualityGateResult } from './quality-gates.js';

/**
 * Configuration for the orchestrator
 */
export type OrchestratorConfig = {
  maxDepth?: number;
  maxSpawns?: number;
  strictMode?: boolean;
  forceSleep?: boolean;
  spawnAdapter?: SpawnAdapter;
  simulateWhenNoAdapter?: boolean;
  verbose?: boolean;
};

/**
 * Normalize and freeze config to prevent mutations
 */
export function normalizeConfig(cfg: OrchestratorConfig): Omit<Required<OrchestratorConfig>, 'spawnAdapter'> & { spawnAdapter?: SpawnAdapter } {
  const normalized = {
    maxDepth: cfg.maxDepth ?? 4,
    maxSpawns: cfg.maxSpawns ?? 10,
    strictMode: Boolean(cfg.strictMode),
    forceSleep: Boolean(cfg.forceSleep),
    simulateWhenNoAdapter: cfg.simulateWhenNoAdapter ?? false,
    spawnAdapter: cfg.spawnAdapter,
    verbose: Boolean(cfg.verbose)
  };
  
  if (normalized.verbose) {
    console.log(JSON.stringify({
      where: 'orchestrator.constructor.rawCfg',
      keys: Object.keys(cfg),
      spawnAdapterType: typeof cfg.spawnAdapter
    }));
  }
  
  return Object.freeze(normalized);
}

/**
 * Result from spawn execution
 */
export interface SpawnResult {
  runId: string;
  output: unknown;
}

/**
 * Adapter for requesting spawns from external executor (e.g., worker main thread)
 */
export type SpawnAdapter = (args: {
  agentName: string;
  prompt: string;
  input: unknown;
}) => Promise<SpawnResult>;

/**
 * Result of spawn gate enforcement
 */
export interface SpawnGateResult {
  ok: boolean;
  reason?: string;
}

/**
 * Input for supervised spawn operations
 */
export interface SupervisedSpawnInput {
  parentRunId: string | null;
  agentName: string;
  depth: number;
  input: Record<string, any>;
  prompt: string;
  requiredKeys?: string[];
  minNumericCount: number;
}

/**
 * Result of supervised spawn operation
 */
export interface SupervisedSpawnResult {
  ok: boolean;
  reason?: string;
  runId: string;
  output?: Record<string, any>;
  attempts?: number;
}

/**
 * Depth3 proof verification result
 */
export interface Depth3ProofVerification {
  ok: boolean;
    errors: string[];
  numericCount: number;
}

/**
 * Depth3 proof record
 */
export interface Depth3Proof {
  runId: string;
  nonce: string;
  hashProof: string;
}

/**
 * Spawn request structure for depth1 orchestrator
 */
export interface SpawnRequest {
  child_name: string;
  input: Record<string, any>;
}

/**
 * Output from depth1 orchestrator
 */
export interface Depth1Output {
  spawn_requests: SpawnRequest[];
}

/**
 * Output from depth2 worker
 */
export interface Depth2Output {
  metric: number;
  computation: string;
  spawn_request: SpawnRequest;
}

/**
 * Output from depth3 micro worker
 */
export interface Depth3Output {
  hashProof: string;
  timestamp: number;
}

/**
 * Verification details for proof validation
 */
export interface VerificationDetails {
  allSignaturesValid: boolean;
  depth3ProofVerified: boolean;
  depth3Proofs: Depth3Proof[];
  errors: string[] | import('./trace-validation.js').ValidationError[];
}

/**
 * Complete proof result
 */
export interface ProofResult {
  ok: boolean;
  maxDepth: number;
  deepestDepthReached: number;
  spawnsExecuted: number;
  runtimeMode: string;
  strictMode: boolean;
  verification: VerificationDetails;
  trace: any[];
  reason?: string;
  output?: {
    depth2Outputs: Record<string, any>[];
  };
}

/**
 * Parameters for subagent execution
 */
export interface SubagentExecutionParams {
  agentName: string;
  input: Record<string, any>;
  prompt: string;
  runId: string;
}

/**
 * Parameters for prompt building
 */
export interface PromptBuildParams {
  agentName: string;
  input: Record<string, any>;
  prompt: string;
  runId: string;
}

/**
 * Global runSubagent function type
 */
declare global {
  var runSubagent: ((params: { description: string; prompt: string }) => Promise<string>) | undefined;
}

/**
 * Hardened orchestrator for recursive proof-of-execution with cryptographic verification
 */
export class RecursionProofOrchestratorHardened {
  private maxDepth: number;
  private maxSpawns: number;
  private strictMode: boolean;
  // @ts-expect-error - forceSleep reserved for future use
  private forceSleep: boolean;
  private spawnAdapter: SpawnAdapter | undefined;
  private secret: Buffer;
  private registry: SupervisorRunRegistry;
  private trace: SignedTrace;
  private runtimeMode: string | null;
  private depth3ProofsVerified: Depth3Proof[];

  constructor({ maxDepth = 4, maxSpawns = 10, strictMode = false, forceSleep = false, spawnAdapter = undefined, simulateWhenNoAdapter = false, verbose = false }: OrchestratorConfig) {
    console.log(
      JSON.stringify({
        where: "constructor.entry",
        keys: Object.keys(arguments[0] ?? {}),
        spawnAdapterType: typeof (arguments[0] as any)?.spawnAdapter,
        simulateWhenNoAdapter: (arguments[0] as any)?.simulateWhenNoAdapter,
        simulateWhenNoAdapterDestructured: simulateWhenNoAdapter,
        verbose: (arguments[0] as any)?.verbose,
        verboseDestructured: verbose
      })
    );
    
    this.maxDepth = maxDepth;
    this.maxSpawns = maxSpawns;
    this.strictMode = strictMode;
    this.forceSleep = forceSleep;
    this.spawnAdapter = spawnAdapter;
    
    console.log(
      JSON.stringify({
        where: "constructor.after_assign",
        hasSpawnAdapter: typeof this.spawnAdapter === "function"
      })
    );

    this.secret = loadSupervisorSecret();
    this.registry = new SupervisorRunRegistry();
    this.trace = new SignedTrace({ supervisorSecret: this.secret });
    
    this.runtimeMode = null; // Will be set to 'real' or 'simulated' on first execution
    this.depth3ProofsVerified = [];
  }

  /**
   * Enforce spawn gate - depth and spawn count limits
   */
  enforceSpawnGate({ requestedDepth }: { requestedDepth: number }): SpawnGateResult {
    if (requestedDepth >= this.maxDepth) {
      return { ok: false, reason: 'depth_limit' };
    }
    if (this.registry.totalSpawns >= this.maxSpawns) {
      return { ok: false, reason: 'spawn_limit' };
    }
    return { ok: true };
  }

  /**
   * Supervised spawn with quality gates and retry
   */
  async supervisedSpawn({
    parentRunId,
    agentName,
    depth,
    input,
    prompt,
    requiredKeys = [],
    minNumericCount = 0
  }: SupervisedSpawnInput): Promise<SupervisedSpawnResult> {
    // Enforce spawn gate
    const gate = this.enforceSpawnGate({ requestedDepth: depth });
    if (!gate.ok) {
      this.trace.addEvent({
        kind: 'limit',
        depth,
        agentName: 'supervisor',
        parentRunId,
        childRunId: null,
        note: gate.reason
      });
      return { ok: false, reason: gate.reason, runId: '' };
    }

    // Mint supervisor-controlled run ID
    const runId = this.registry.mintRunId(agentName);
    
    // Generate nonce for depth3 proof-of-execution
    let nonce: string | null = null;
    if (depth === 3) {
      nonce = crypto.randomBytes(16).toString('hex');
      input.nonce = nonce;
      input.runId = runId; // Provide runId for hash computation
    }
    
    const inputHash = this.trace.hashOf(input);

    // Register spawn in registry with nonce
    this.registry.registerSpawn({ runId, parentRunId, agentName, depth, inputHash, nonce });

    // Record signed spawn event
    this.trace.addEvent({
      kind: 'spawn',
      depth,
      agentName,
      parentRunId,
      childRunId: runId,
      inputHash
    });

    // Execute with quality gate and retry
    const attemptFn = async () => {
      const output = await this.simulateSubagentExecution({
        agentName,
        input,
        prompt,
        runId
      });
      
      const outputHash = this.trace.hashOf(output);

      // Register return in registry
      this.registry.registerReturn({ runId, outputHash });

      // Record signed return event
      this.trace.addEvent({
        kind: 'return',
        depth,
        agentName,
        parentRunId,
        childRunId: runId,
        outputHash
      });

      return { runId, output };
    };

    const gateFn = (out: { runId: string; output: Record<string, any> }): QualityGateResult => {
      const gate = qualityGate({
        output: out.output,
        requiredKeys,
        minNumericCount
      });
      
      // Additional verification for depth3: check hashProof
      if (depth === 3 && gate.ok) {
        return this.verifyDepth3Proof({ runId, output: out.output, nonce: nonce! });
      }
      
      return gate;
    };

    const rr = await runWithRetry({
      attemptFn,
      maxAttempts: 2,
      gateFn,
      tightenPromptFn: null
    });

    if (!rr.ok) {
      return {
        ok: false,
        reason: 'quality_gate_failed',
        runId,
        attempts: rr.attempts
      };
    }

    return {
      ok: true,
      runId,
      output: rr.result.output
    };
  }

  /**
   * Verify depth3 proof-of-execution via nonce-based hash
   */
  verifyDepth3Proof({ runId, output, nonce }: { runId: string; output: Record<string, any>; nonce: string }): Depth3ProofVerification {
    if (!nonce) {
      return { ok: false, errors: ['depth3_missing_nonce'], numericCount: 0 };
    }
    
    if (!output.hashProof) {
      return { ok: false, errors: ['depth3_missing_hashProof'], numericCount: 0 };
    }
    
    // Compute expected hash: sha256(nonce + ":" + runId)
    const expectedHash = sha256Hex(`${nonce}:${runId}`);
    
    if (output.hashProof !== expectedHash) {
      console.log(`  [Depth3 Verification] ✗ Hash mismatch`);
      console.log(`    Expected: ${expectedHash}`);
      console.log(`    Got:      ${output.hashProof}`);
      return { ok: false, errors: ['depth3_hash_proof_mismatch'], numericCount: 0 };
    }
    
    console.log(`  [Depth3 Verification] ✓ Hash proof verified`);
    this.depth3ProofsVerified.push({ runId, nonce, hashProof: output.hashProof });
    
    return { ok: true, errors: [], numericCount: 0 };
  }

  /**
   * Run depth 3 proof with fan-out pattern
   * 
   * Pattern: Main → depth1 → 2x depth2 → 2x depth3
   */
  async runDepth3Proof(): Promise<ProofResult> {
    console.log('='.repeat(80));
    console.log('DEPTH 3 FAN-OUT RECURSION PROOF');
    console.log('='.repeat(80));
    console.log(`Configuration: maxDepth=${this.maxDepth}, maxSpawns=${this.maxSpawns}`);
    console.log(`Strict mode: ${this.strictMode}`);
    console.log();

    const root = { depth: 0, maxDepth: this.maxDepth };

    // Spawn depth1 orchestrator
    console.log('[Depth 0] Spawning depth1 orchestrator...');
    const depth1 = await this.supervisedSpawn({
      parentRunId: null,
      agentName: 'depth1_orchestrator',
      depth: 1,
      input: { ...root, depth: 1 },
      prompt: 'Return JSON with spawn_requests for two depth2 workers.',
      requiredKeys: ['spawn_requests'],
      minNumericCount: 0
    });

    if (!depth1.ok) return this.fail(depth1.reason!);

    // Validate depth1 returned 2 spawn requests
    const spawnReqs: SpawnRequest[] = Array.isArray(depth1.output!.spawn_requests)
      ? depth1.output!.spawn_requests
      : [];
    
    if (spawnReqs.length !== 2) {
      return this.fail('depth1_missing_two_requests');
    }

    console.log(`[Depth 1] ✓ Orchestrator returned ${spawnReqs.length} spawn requests`);

    const depth2Outputs: Record<string, any>[] = [];

    // Spawn each depth2 worker
    for (let i = 0; i < spawnReqs.length; i++) {
      const req = spawnReqs[i];
      console.log(`[Depth 1] Spawning depth2 worker ${i + 1}...`);

      const d2 = await this.supervisedSpawn({
        parentRunId: depth1.runId,
        agentName: req.child_name || `depth2_worker_${String.fromCharCode(97 + i)}`,
        depth: 2,
        input: req.input || { depth: 2, maxDepth: this.maxDepth },
        prompt: 'Return JSON and include spawn_request for one depth3 worker.',
        requiredKeys: ['spawn_request', 'metric'],
        minNumericCount: 1
      });

      if (!d2.ok) return this.fail(d2.reason!);

      console.log(`[Depth 2] ✓ Worker ${i + 1} completed`);
      depth2Outputs.push(d2.output!);

      // Validate depth2 returned depth3 spawn request
      const d3req = d2.output!.spawn_request as SpawnRequest;
      if (!d3req || !d3req.child_name) {
        return this.fail('depth2_missing_depth3_request');
      }

      console.log(`[Depth 2] Spawning depth3 micro worker ${i + 1}...`);

      // Spawn depth3 micro worker
      const d3 = await this.supervisedSpawn({
        parentRunId: d2.runId,
        agentName: d3req.child_name,
        depth: 3,
        input: d3req.input || { depth: 3, maxDepth: this.maxDepth },
        prompt: 'Compute cryptographic proof-of-execution.',
        requiredKeys: ['hashProof', 'timestamp'],
        minNumericCount: 1
      });

      if (!d3.ok) return this.fail(d3.reason!);

      console.log(`[Depth 3] ✓ Micro worker ${i + 1} completed with proof`);
    }

    // Record merge event
    this.trace.addEvent({
      kind: 'merge',
      depth: 0,
      agentName: 'supervisor',
      parentRunId: null,
      childRunId: null,
      note: 'merged_depth2_depth3_results'
    });

    // Validate trace signatures
    const traceEvents = this.trace.export();
    const verification = validateTrace({
      supervisorSecret: this.secret,
      traceEvents,
      registry: this.registry
    });

    const deepest = verification.ok ? 3 : 0;
    
    // Check if depth3 proofs were verified
    const depth3ProofVerified = this.depth3ProofsVerified.length === 2;

    console.log();
    console.log('='.repeat(80));
    console.log('PROOF VALIDATION');
    console.log('='.repeat(80));
    console.log(`✓ Deepest depth reached: ${deepest}`);
    console.log(`✓ Spawns executed: ${this.registry.totalSpawns}`);
    console.log(`✓ All signatures valid: ${verification.ok}`);
    console.log(`✓ Depth3 proofs verified: ${depth3ProofVerified} (${this.depth3ProofsVerified.length}/2)`);
    console.log(`✓ Runtime mode: ${this.runtimeMode}`);
    console.log(`✓ Strict mode: ${this.strictMode}`);
    console.log('='.repeat(80));

    return {
      ok: verification.ok && depth3ProofVerified,
      maxDepth: this.maxDepth,
      deepestDepthReached: deepest,
      spawnsExecuted: this.registry.totalSpawns,
      runtimeMode: this.runtimeMode!,
      strictMode: this.strictMode,
      verification: {
        allSignaturesValid: verification.ok,
        depth3ProofVerified,
        depth3Proofs: this.depth3ProofsVerified,
        errors: verification.errors
      },
      trace: traceEvents,
      output: { depth2Outputs }
    };
  }

  /**
   * Return failure object with trace
   */
  fail(reason: string): ProofResult {
    return {
      ok: false,
      reason,
      maxDepth: this.maxDepth,
      deepestDepthReached: 0,
      spawnsExecuted: this.registry.totalSpawns,
      runtimeMode: this.runtimeMode || 'unknown',
      strictMode: this.strictMode,
      verification: {
        allSignaturesValid: false,
        depth3ProofVerified: false,
        depth3Proofs: [],
        errors: []
      },
      trace: this.trace.export()
    };
  }

  /**
   * Execute subagent with runtime detection
   */
  async simulateSubagentExecution({ agentName, input, prompt, runId }: SubagentExecutionParams): Promise<Record<string, any>> {
    console.log(`  [${agentName}] DEBUG: has spawnAdapter=${!!this.spawnAdapter} strictMode=${this.strictMode}`);
    console.log(`  [${agentName}] Executing (runId: ${runId.substring(0, 20)}...)`);

    // Use spawnAdapter if provided (worker mode)
    if (this.spawnAdapter) {
      const spawnResult = await this.spawnAdapter({
        agentName,
        prompt,
        input
      });
      console.log(`  [${agentName}] ✓ Returned from adapter with runId: ${spawnResult.runId}`);
      
      // Strict validation: spawnAdapter MUST return valid output
      if (typeof spawnResult.output === 'undefined') {
        throw new Error(`spawnAdapter_missing_output: ${agentName} returned undefined output`);
      }
      if (!spawnResult.runId || typeof spawnResult.runId !== 'string') {
        throw new Error(`spawnAdapter_invalid_runId: ${agentName} returned invalid runId`);
      }
      
      return spawnResult.output as Record<string, any>;
    }

    // Check if runSubagent tool is available
    const isStandalone = typeof globalThis.runSubagent === 'undefined';

    if (isStandalone) {
      // Strict mode: fail hard if tool missing
      if (this.strictMode) {
        console.log(`  [${agentName}] ✗ STRICT MODE: runSubagent tool missing`);
        
        this.trace.addEvent({
          kind: 'limit',
          depth: input.depth,
          agentName: 'supervisor',
          parentRunId: input.parentRunId || null,
          childRunId: runId,
          note: 'tool_missing_strict'
        });
        
        throw new Error('STRICT MODE: runSubagent tool not available');
      }
      
      // Non-strict mode: use simulation with warning
      console.log(`  [${agentName}] ⚠️  Using simulation mode (runSubagent not available)`);
      
      if (this.runtimeMode === null) {
        this.runtimeMode = 'simulated';
        this.trace.addEvent({
          kind: 'limit',
          depth: 0,
          agentName: 'supervisor',
          parentRunId: null,
          childRunId: null,
          note: 'simulation_warning'
        });
      }
      
      return this.simulateForTesting({ agentName, input, runId });
    }
    
    // Set runtime mode to real on first actual execution
    if (this.runtimeMode === null) {
      this.runtimeMode = 'real';
    }

    // Construct detailed prompt based on depth and expected output
    const fullPrompt = this.buildSubagentPrompt({ agentName, input, prompt, runId });

    try {
      // Call actual runSubagent tool
      const result = await globalThis.runSubagent!({
        description: agentName,
        prompt: fullPrompt
      });

      // Parse JSON response
      const output = JSON.parse(result);
      
      console.log(`  [${agentName}] ✓ Returned ${Object.keys(output).length} keys`);
      
      return output;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`  [${agentName}] ✗ Execution failed:`, errorMessage);
      throw new Error(`Subagent ${agentName} failed: ${errorMessage}`);
    }
  }

  /**
   * Build detailed prompt for subagent execution
   */
  buildSubagentPrompt({ agentName, input, prompt, runId }: PromptBuildParams): string {
    const baseContext = `
You are ${agentName} at depth ${input.depth} of a recursive orchestration system.
Run ID: ${runId}
Max Depth: ${input.maxDepth}

CRITICAL: You must return ONLY valid JSON. No markdown, no explanation, no code blocks.
`;

    // Depth1: Orchestrator that spawns 2 depth2 workers
    if (agentName.includes('depth1')) {
      return `${baseContext}

Your task: ${input.task || 'Orchestrate depth2 workers'}

You must return JSON with this exact structure:
{
  "spawn_requests": [
    {
      "child_name": "depth2_worker_a",
      "input": { "depth": 2, "maxDepth": ${input.maxDepth}, "task": "Calculate set A" }
    },
    {
      "child_name": "depth2_worker_b",
      "input": { "depth": 2, "maxDepth": ${input.maxDepth}, "task": "Calculate set B" }
    }
  ]
}

Return exactly 2 spawn requests. Each spawn_request must have child_name and input fields.`;
    }

    // Depth2: Worker that spawns 1 depth3 micro worker
    if (agentName.includes('depth2')) {
      return `${baseContext}

Your task: ${input.task || 'Process data and spawn depth3 worker'}

You must return JSON with this exact structure:
{
  "metric": <any integer value>,
  "computation": "contrast_analysis",
  "spawn_request": {
    "child_name": "depth3_micro_${agentName.slice(-1)}",
    "input": { "depth": 3, "maxDepth": ${input.maxDepth} }
  }
}

The metric field must be an integer.
The spawn_request must have child_name and input fields.`;
    }

    // Depth3: Compute cryptographic proof with nonce
    if (agentName.includes('depth3')) {
      return `${baseContext}

Your task: Compute cryptographic proof of execution

You have been given:
- nonce: "${input.nonce}"
- runId: "${input.runId}"

You must compute:
hashProof = sha256(nonce + ":" + runId)
         = sha256("${input.nonce}:${input.runId}")

You must return JSON with this exact structure:
{
  "hashProof": "<computed sha256 hex string>",
  "timestamp": ${Date.now()}
}

CRITICAL: You must actually compute the sha256 hash. Do not return a placeholder.
The supervisor will verify this hash. If it does not match, you will fail.`;
    }

    // Fallback for other agents
    return `${baseContext}

${prompt}`;
  }

  /**
   * Fallback simulation for standalone testing
   */
  simulateForTesting({ agentName, input, runId: _runId }: { agentName: string; input: Record<string, any>; runId: string }): Record<string, any> {
    // Depth1: Return 2 spawn requests
    if (agentName.includes('depth1')) {
      return {
        spawn_requests: [
          {
            child_name: 'depth2_worker_a',
            input: { depth: 2, maxDepth: input.maxDepth, task: 'Calculate set A' }
          },
          {
            child_name: 'depth2_worker_b',
            input: { depth: 2, maxDepth: input.maxDepth, task: 'Calculate set B' }
          }
        ]
      };
    }

    // Depth2: Return 1 spawn request + metric
    if (agentName.includes('depth2')) {
      return {
        metric: Math.floor(Math.random() * 100),
        computation: 'contrast_analysis',
        spawn_request: {
          child_name: `depth3_micro_${agentName.slice(-1)}`,
          input: { depth: 3, maxDepth: input.maxDepth }
        }
      };
    }

    // Depth3: Compute actual hash proof
    if (input.nonce && input.runId) {
      const hashProof = sha256Hex(`${input.nonce}:${input.runId}`);
      return {
        hashProof,
        timestamp: Date.now()
      };
    }

    // Fallback if nonce missing
    return {
      hashProof: 'simulation_no_nonce',
      timestamp: Date.now()
    };
  }
}

























