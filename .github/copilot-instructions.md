# Copilot Instructions - Confucius SDK Enforcement

## MANDATORY Protocol for All Code Changes

**⚠️ CRITICAL**: You MUST use Confucius SDK for all coding tasks in this repository.

### Before ANY code modification:

1. **Run Confucius verification first:**
   ```bash
   node packages/confucius-recursion-sdk/dist/cli-worker.js
   ```
   
   With environment:
   ```bash
   CONFUCIUS_USE_WORKER=true
   CONFUCIUS_STRICT_MODE=true
   CONFUCIUS_TASK="<describe the task>"
   ```

2. **Parse the JSON output**

3. **STOP if `ok: false`** - Report the error from the output

4. **Only proceed if `ok: true`** - Extract plan from trace events

### Exit Code Rules

| Code | Action |
|------|--------|
| 0 | ✅ Proceed with implementation |
| 1 | ⚠️ Review and retry |
| 2 | ❌ Cannot proceed - tool missing |
| 5 | 🚫 Asleep - protocol violation |

### Required Trace Events

Output must contain:
- ✅ `preflight_ok`
- ✅ `plan_created`  
- ✅ `quality_gate_pass`
- ✅ `spawn` (at least one)

**Missing events = Exit code 5 = Protocol violation**

### VS Code Task Shortcut

Instead of terminal commands, use:
- **Task:** `🧪 Confucius: Verify Agent Ready (Strict)`
- **Location:** Command Palette → Tasks: Run Task

### Why This Matters

Without Confucius SDK:
- ❌ No supervisor validation
- ❌ No quality gates enforced
- ❌ No signed trace
- ❌ No recursion depth limits
- ❌ No proof of execution

**Direct model calls bypass all guarantees.**

### Workflow Example

```
User: "Add authentication to the wallet API"

Agent: 
1. Run: node packages/confucius-recursion-sdk/dist/cli-worker.js
   with CONFUCIUS_TASK="Add authentication to wallet API"
2. Check output: ok: true, runtimeMode: "real"
3. Read trace for plan_created event
4. Follow the plan from the trace
5. Implement with quality gate validation
```

### Enforcement

This is **non-negotiable**. The SDK is the only authorized entry point for agentic work.

**Bypassing Confucius = No guarantees = Unacceptable risk**
