# Confucius Agent

**Agentic supervisor CLI and SDK** - Clean product interface to the Confucius recursion engine.

## Installation

```bash
npm install --save-dev @aldine/confucius-agent
```

## Usage

### CLI

Run supervised agentic tasks with proof generation:

```bash
npx confucius-run
```

The CLI automatically enables strict mode and worker threads for agentic contexts.

**Environment variables:**

- `CONFUCIUS_TASK` - Task description for the agent
- `CONFUCIUS_USE_WORKER` - Enable worker thread mode (default: `true`)
- `CONFUCIUS_STRICT_MODE` - Require real runtime tools (default: `true`)
- `CONFUCIUS_VERBOSE` - Enable verbose logging
- `CONFUCIUS_FORCE_SLEEP` - Force asleep state for testing (exits 5)

**Exit codes:**

- `0` - Success (contract satisfied, proof valid)
- `1` - Proof failed (runtime error)
- `2` - tool_missing_strict (strict mode but no `runSubagent` available)
- `5` - ASLEEP (contract violated or `FORCE_SLEEP` enabled)

### API

Import and use the supervisor in your code:

```typescript
import { runWithConfucius, type SpawnAdapter } from '@aldine/confucius-agent';

const spawnAdapter: SpawnAdapter = async (args) => {
  // Your agent runner implementation
  return { runId: 'abc123', output: result };
};

const proof = await runWithConfucius({
  task: 'Implement feature X',
  spawnAdapter,
  depth: 3
});

console.log('Proof valid:', proof.ok);
console.log('Engagement:', proof.engagement);
```

## Architecture

This package is a thin wrapper around `@aldine/confucius-recursion-sdk`, providing:

- **Clean CLI** - Single command (`confucius-run`) with sensible defaults
- **Product API** - Re-exports core types and functions
- **Agentic defaults** - Strict mode and worker threads enabled by default

The internal engine (`confucius-recursion-sdk`) handles:

- Supervised recursion with signed trace
- Quality gates and proof validation
- Worker thread orchestration
- Asleep detection and engagement scoring

## VS Code Integration

Add tasks to `.vscode/tasks.json`:

```json
{
  "label": "Confucius: Verify Agent Ready",
  "type": "shell",
  "command": "npx",
  "args": ["confucius-run"],
  "options": {
    "env": {
      "CONFUCIUS_TASK": "Verify agent readiness"
    }
  }
}
```

## Documentation

For detailed engine documentation, see [@aldine/confucius-recursion-sdk](https://github.com/Aldine/confucius-vision-scafolding-sdk/tree/main/packages/confucius-recursion-sdk).

## License

MIT
