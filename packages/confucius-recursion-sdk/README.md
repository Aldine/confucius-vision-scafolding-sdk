# @aldine/confucius-recursion-sdk

**Supervised recursion proof harness with signed trace, quality gates, and strict-mode execution for agentic IDE runtimes.**

## 🎯 What This Is

A TypeScript SDK that enforces recursive patterns, quality gates, and trace validation for AI agent execution. Prevents token rot, ensures depth limits, and provides cryptographic proof of execution.

**Key Features:**
- ✅ **Supervisor-controlled spawning** - All subagent calls validated
- ✅ **Quality gates with retry** - Invalid outputs rejected automatically  
- ✅ **Signed trace** - HMAC verification prevents fabrication
- ✅ **Depth & spawn limits** - Hard gates prevent runaway recursion
- ✅ **Asleep detection** - Catches agents that ignore protocol
- ✅ **Worker mode** - Non-blocking orchestration with message passing
- ✅ **Strict mode** - Fails hard when tools missing

## 🚀 Quick Start

### Installation

```bash
npm install @aldine/confucius-recursion-sdk
```

### Basic Usage

```typescript
import { runWithConfucius } from '@aldine/confucius-recursion-sdk'

const result = await runWithConfucius('Implement feature X', {
  strictMode: true,
  maxDepth: 4,
  maxSpawns: 10
})

if (result.ok) {
  console.log('✅ Success:', result.verification)
  console.log('Depth reached:', result.deepestDepthReached)
} else {
  console.error('❌ Failed:', result.reason)
}
```

### CLI Usage

```bash
# Standard mode (simulates when runSubagent missing)
node dist/cli.js

# Worker mode (orchestration in background thread)
CONFUCIUS_USE_WORKER=true node dist/cli-worker.js

# Strict mode (fails if runSubagent missing)
CONFUCIUS_STRICT_MODE=true CONFUCIUS_USE_WORKER=true node dist/cli-worker.js
```

## 🎭 Agentic IDE Integration

**⚠️ CRITICAL**: For use with GitHub Copilot, Continue, Cline, Claude Code, Cursor, or any agentic IDE:

**Read the full integration guide:** [AGENTIC-IDE-INTEGRATION.md](./AGENTIC-IDE-INTEGRATION.md)

**TL;DR:**
1. Run Confucius verification **before any code changes**
2. Use VS Code task: `🧪 Confucius: Verify Agent Ready (Strict)`  
3. Check exit code and JSON output
4. Only proceed if `ok: true` and trace contains required events

**Why:** Direct model calls bypass supervisor validation, quality gates, and trace signing.

**The SDK must be the only entry point for agentic work.**

## 📊 Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | All gates passed, verification complete |
| 1 | Quality gate failed | Review trace, adjust prompts, retry |
| 2 | Tool missing (strict mode) | Cannot proceed - runSubagent unavailable |
| 5 | Asleep detection | Agent failed to follow protocol |

## 🏗️ Architecture

### Standard Mode

```
┌─────────────┐
│   Main      │
│   Thread    │
├─────────────┤
│ Orchestrator│──► Quality Gates
│             │──► Supervisor
│             │──► Signed Trace
└─────────────┘
```

### Worker Mode

```
┌─────────────┐     ┌──────────────┐
│   Main      │◄───►│   Worker     │
│   Thread    │     │   Thread     │
├─────────────┤     ├──────────────┤
│ Tool Exec   │     │ Orchestrator │
│ Adapter     │     │ Supervisor   │
│             │     │ Gates/Trace  │
└─────────────┘     └──────────────┘
         ▲                 │
         └─────Messages────┘
```

Worker mode provides:
- Non-blocking orchestration
- Parallel proof verification
- Isolated state management

## 🔐 Security Features

### Supervisor Secret

```bash
# Production: Set a persistent secret
export CONFUCIUS_SUPERVISOR_SECRET="your-256-bit-secret"

# Development: Ephemeral secret (auto-generated)
# Warning shown in output
```

### Trace Validation

All events are HMAC-signed with the supervisor secret:
- Prevents fabrication
- Ensures execution order
- Cryptographic proof of work

### Quality Gates

Every subagent output validated:
- Required keys present
- Minimum numeric values met
- No handwave/placeholder phrases
- Retry with stricter prompt on failure

## 📈 Example Output

```json
{
  "ok": true,
  "runtimeMode": "real",
  "strictMode": true,
  "workerMode": true,
  "deepestDepthReached": 3,
  "spawnsExecuted": 5,
  "verification": {
    "allSignaturesValid": true,
    "depth3ProofVerified": true,
    "depth3Proofs": [
      {
        "runId": "depth3_micro_a_...",
        "nonce": "fa839755526d151a...",
        "hashProof": "d27da3640299eb36..."
      }
    ],
    "errors": []
  },
  "asleepDetector": {
    "ok": true,
    "traceCount": 12,
    "verificationOk": true,
    "hasPreflightOk": true,
    "hasPlanCreated": true,
    "hasEngagement": true
  }
}
```

## 🔧 Configuration

### Environment Variables

```bash
# Execution mode
CONFUCIUS_USE_WORKER=true        # Enable worker mode
CONFUCIUS_STRICT_MODE=true       # Fail on missing tools

# Testing
CONFUCIUS_FORCE_SLEEP=true       # Intentionally fail asleep detection
CONFUCIUS_VERBOSE=true           # Detailed logging

# Task specification
CONFUCIUS_TASK="Your task here"  # Override default task

# Security
CONFUCIUS_SUPERVISOR_SECRET=...  # Persistent supervisor secret
```

### TypeScript Configuration

```typescript
import { runWithConfucius } from '@aldine/confucius-recursion-sdk'

const result = await runWithConfucius(task, {
  strictMode: true,          // Fail hard on missing tools
  maxDepth: 4,               // Maximum recursion depth
  maxSpawns: 10,             // Maximum total spawns
  forceSleep: false,         // Testing mode for asleep detection
  verbose: true              // Enable detailed logging
})
```

## 🧪 Testing

```bash
# Build the SDK
npm run build

# Run basic proof
npm run confucius-run

# Test asleep detection
npm test:asleep

# Test worker mode
npm run worker:run

# Verify strict mode
CONFUCIUS_STRICT_MODE=true npm run worker:run
```

## 📚 Documentation

- [Agentic IDE Integration Guide](./AGENTIC-IDE-INTEGRATION.md) - **Start here for IDE use**
- [Architecture Overview](./ARCHITECTURE.md) - System design and components
- [API Reference](./API.md) - TypeScript API documentation

## 🤝 Contributing

This SDK enforces strict patterns for agentic execution. Changes must:
1. Pass all existing tests
2. Maintain strict TypeScript types
3. Preserve trace signature validation
4. Not bypass quality gates

## 📄 License

MIT

## 🔗 Related

- [Ralph Protocol](../ralph-protocol/) - Message passing and spawn request patterns
- [MCP Browser Tools](../mcp-browser/) - Browser automation for agents

---

**For agentic IDE users:** This README covers SDK usage. For IDE integration, **read [AGENTIC-IDE-INTEGRATION.md](./AGENTIC-IDE-INTEGRATION.md) first.**
