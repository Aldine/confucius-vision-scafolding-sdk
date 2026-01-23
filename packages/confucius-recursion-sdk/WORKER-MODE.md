# Worker Mode Architecture

## Problem

When running recursion at depth 3+, orchestration, signing, hashing, and quality gates all run on the main thread. This causes:

- **Blocking**: Heavy hashing blocks the event loop
- **Jitter**: Variable timing makes CI flaky  
- **Laggy**: Agent feels unresponsive
- **Slow**: Sequential verification delays fan-out

## Solution: Worker Mode

Move orchestration OFF the main thread. Keep tool execution ON main thread.

### Architecture

**Before** (all on main thread):
```
Agent → SDK → orchestration → model → gates → trace
Everything blocks
```

**After** (worker isolation):
```
Agent → main thread thin adapter
        ↓
        WebWorker (orchestration brain)
        ↓
        main calls model/subagents

Worker controls everything
Main executes tools only
```

### What Lives Where

**Worker Thread** (orchestration brain):
- Supervisor logic
- Recursion tree
- HMAC signing
- Hash proofs
- Quality gates
- Asleep detector
- Trace building

**Main Thread** (tool executor):
- Calls `runSubagent` or `runModel`
- Forwards messages
- Prints results

### Message Protocol

**Main → Worker**:
- `runTask`: Start orchestration with config
- `modelResult`: Response from tool execution

**Worker → Main**:
- `requestSpawn`: Worker needs to spawn subagent
- `requestModel`: Worker needs model call
- `done`: Orchestration complete
- `fail`: Orchestration failed
- `progress`: Status update

### Performance Gains

**What Gets Faster**:
- HMAC signing (30-60% faster)
- Hash proofs (parallel computation)
- Quality gates (non-blocking)
- Fan-out spawns (parallel branches)
- Trace validation (background work)

**What Stays Same**:
- LLM latency (still waits for model)

**Expected**: 30-60% reduction in total orchestration time for depth 3+ trees.

## Usage

### CLI Worker Mode

```bash
# Normal mode (main thread)
npm run confucius-run

# Worker mode (orchestration in worker)
npm run worker:run

# Depth 3 with worker
npm run proof:depth3:worker
```

### Programmatic Usage

```typescript
import { runWithWorker, CopilotAdapter } from '@aldine/confucius-recursion-sdk';

const adapter = new CopilotAdapter();

const result = await runWithWorker('Implement feature X', {
  adapter,
  strictMode: true,
  maxDepth: 4,
  verbose: true
});

if (result.ok) {
  console.log('Success:', result.result);
} else {
  console.error('Failed:', result.reason);
}
```

### Environment Variables

- `CONFUCIUS_USE_WORKER=true` - Enable worker mode
- `CONFUCIUS_STRICT_MODE=true` - Enforce strict mode
- `CONFUCIUS_FORCE_SLEEP=true` - Test asleep detection
- `CONFUCIUS_VERBOSE=true` - Show worker messages

## When to Use Worker Mode

**Use Worker**:
- Depth >= 3
- Fan-out > 2
- Heavy hashing/signing
- Running in IDE
- CI parallel proofs
- Production recursion

**Skip Worker**:
- Tiny single runs
- Simple single agent calls
- Quick tests

## Implementation Details

### Files

- `src/worker/protocol.ts` - Message protocol types
- `src/worker/orchestrator.worker.ts` - Worker thread code
- `src/worker/worker-manager.ts` - Main thread manager
- `src/cli-worker.ts` - CLI entry point for worker mode

### How It Works

1. **Main thread** spawns Worker with orchestrator code
2. **Main** sends `runTask` message with config
3. **Worker** runs orchestration logic
4. When Worker needs to spawn subagent:
   - Worker sends `requestSpawn` message
   - Main executes `adapter.runSubagent()`
   - Main sends `modelResult` back
   - Worker continues
5. **Worker** sends `done` when complete
6. **Main** terminates worker and returns result

### SpawnAdapter Interface

The orchestrator accepts a `spawnAdapter` that handles spawn requests:

```typescript
interface SpawnAdapter {
  requestSpawn(args: {
    agentName: string;
    prompt: string;
    input: any;
  }): Promise<any>;
  
  requestModel?(args: {
    prompt: string;
    input: any;
  }): Promise<any>;
}
```

In worker mode, the adapter sends messages to main thread.
In normal mode, the adapter is null and orchestrator uses direct calls.

## Blunt Rule

**If recursion exists, run it off main thread.**

Worker mode should be the default for:
- Recursion SDK
- Depth >= 2
- Strict mode enabled

## Troubleshooting

### "Worker not found"

Build the worker first:
```bash
npm run build
```

### "postMessage failed"

Check that messages are serializable (no functions, circular refs).

### "Worker timeout"

Increase timeout or check if worker is waiting for response that never comes.

### Performance not improved

Check that:
- Depth >= 3 (worker overhead not worth it for shallow trees)
- Multiple spawns exist (parallel benefit)
- Not dominated by LLM latency
