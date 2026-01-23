# Confucius SDK: Agentic IDE Integration

**Critical**: This SDK must be the **only entry point** for all agentic coding work to ensure recursive patterns, quality gates, and trace validation are enforced.

## Integration Rules

### 🔒 Layer 1: Bypass Prevention

The SDK exports **one public entrypoint only**: `runWithConfucius`

```typescript
import { runWithConfucius } from '@aldine/confucius-recursion-sdk'

// ✅ CORRECT: All work goes through the SDK
const result = await runWithConfucius(task, { strictMode: true })

// ❌ WRONG: Direct model calls bypass gates and validation
const output = await runSubagent({ ... })  // NO GUARANTEES
```

**Package exports are locked down** - internal helpers cannot be imported directly.

---

### 🎯 Layer 2: Agent Enforcement

#### VS Code Tasks (All Agentic Hosts)

The SDK provides VS Code tasks that **must** run before any code changes:

**Critical Pre-flight Task:**
```
🧪 Confucius: Verify Agent Ready (Strict)
```

**Main Execution Task:**
```
🎯 Confucius: Execute Task (Worker Mode)
```

#### How to Use in Your Agentic Workflow

**For GitHub Copilot / Copilot Workspace:**
1. Open Command Palette (Ctrl+Shift+P)
2. Run: `Tasks: Run Task`
3. Select: `🧪 Confucius: Verify Agent Ready (Strict)`
4. Wait for exit code 0 before proceeding

**For Continue / Cline / Aider:**
Add this instruction to your system prompt or rules:

```markdown
MANDATORY: Before any code changes:
1. Run VS Code task "Confucius: Verify Agent Ready (Strict)"
2. Parse the JSON output
3. If ok=false, STOP and report the failure
4. If ok=true, follow the plan in the trace output
```

**For Claude Code / Cursor:**
Use the command:
```bash
node packages/confucius-recursion-sdk/dist/cli-worker.js
```
With environment:
- `CONFUCIUS_USE_WORKER=true`
- `CONFUCIUS_STRICT_MODE=true`

---

### ⚡ Layer 3: Hard Enforcement

#### Strict Mode Requirements

```bash
# MANDATORY environment for agentic IDE use:
CONFUCIUS_STRICT_MODE=true       # Fail hard on missing tools
CONFUCIUS_USE_WORKER=true        # Worker-based orchestration
CONFUCIUS_VERBOSE=false          # Clean JSON output only
```

#### Exit Codes

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success - all gates passed | Proceed with implementation |
| 1 | Quality gate failed | Review trace, retry |
| 2 | Tool missing (strict mode) | Cannot proceed - missing runSubagent |
| 5 | Asleep detection - no engagement | Agent failed to follow protocol |

#### Required Trace Events

The output **must** contain these trace events:
- ✅ `preflight_ok`
- ✅ `plan_created`
- ✅ `quality_gate_pass`
- ✅ `spawn` (at least one)

**If any are missing:** Exit code 5, agent is "asleep"

---

## System Prompts for Agentic Hosts

### For All Hosts (GitHub Copilot, Continue, Cline, Claude Code, Cursor)

Add this to your agent's system instructions:

```markdown
## Confucius SDK Protocol

You MUST route every coding task through Confucius SDK.

**Mandatory first step:**
1. Run VS Code task: "Confucius: Verify Agent Ready (Strict)"
   OR execute: `node packages/confucius-recursion-sdk/dist/cli-worker.js`
2. Parse the JSON output
3. If `ok: false`, STOP and report the error
4. If `ok: true`, extract the plan from `trace` events

**Required environment:**
- CONFUCIUS_STRICT_MODE=true
- CONFUCIUS_USE_WORKER=true

**Do not write code until:**
- Confucius returns exit code 0
- Trace includes: preflight_ok, plan_created, quality_gate_pass
- runtimeMode is "real" (not "simulated")

**If you see:**
- exit code 5: You failed to engage - retry with better prompts
- exit code 2: Missing runSubagent tool - cannot proceed
- runtimeMode "simulated": You are in fallback mode - gates not enforced
```

---

## Verification Checklist

Run this test to confirm integration:

```bash
cd packages/confucius-recursion-sdk

# Set environment
export CONFUCIUS_STRICT_MODE=true
export CONFUCIUS_USE_WORKER=true
export CONFUCIUS_TASK="Test integration"

# Run verification
node dist/cli-worker.js
```

**Pass Criteria:**
- ✅ Exit code 0
- ✅ JSON output with `ok: true`
- ✅ `runtimeMode: "real"` (or "simulated" in standalone)
- ✅ Trace contains required events
- ✅ No `simulation_warning` in trace

**Fail Criteria:**
- ❌ Agent starts coding without running Confucius
- ❌ `runtimeMode: "simulated"` when runSubagent is available
- ❌ Missing trace events
- ❌ Exit code 5 (asleep)

---

## MCP Tool Server (Optional - Best Integration)

For hosts supporting Model Context Protocol (MCP):

**Tool Name:** `confucius.run`

**Contract:**
```typescript
{
  input: {
    task: string
    strictMode: boolean
    useWorker: boolean
  }
  output: {
    ok: boolean
    trace: TraceEvent[]
    verification: VerificationResult
    runtimeMode: 'real' | 'simulated'
  }
}
```

**System Instruction Addition:**
```markdown
For every code modification request:
1. Call tool: confucius.run
2. If output.ok = false: STOP and show verification.errors
3. If output.ok = true: Follow the plan in output.trace
```

---

## Blunt Truth

**Models do not "notice" your SDK by reading code.**

You make them comply by:
1. Making the SDK the only door (exports locked)
2. Making tasks/tools the path of least resistance
3. Hard failing when bypassed (exit code 5)

**If the agent bypasses Confucius:**
- ❌ No supervisor validation
- ❌ No quality gates
- ❌ No signed trace
- ❌ No proof of execution
- ❌ No recursion depth limits

**The SDK is non-negotiable for agentic work.**
