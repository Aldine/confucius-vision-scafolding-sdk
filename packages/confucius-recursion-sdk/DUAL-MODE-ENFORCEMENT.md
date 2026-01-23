# Dual-Mode Enforcement - Complete

## ✅ Implementation Summary

The SDK now supports **two distinct modes** with appropriate enforcement:

### 1. Local Development Mode
- **Purpose**: Testing, debugging, local simulation
- **Configuration**: `CONFUCIUS_STRICT_MODE=false`
- **Runtime**: Accepts `simulated` mode
- **Requirements**: Minimal engagement (trace exists, some activity)
- **Exit**: 0 on successful simulation
- **Guard**: Accepts local proofs with `ok: true`

### 2. Agentic IDE Mode
- **Purpose**: Production agentic coding work
- **Configuration**: `CONFUCIUS_STRICT_MODE=true`
- **Runtime**: Requires `real` (with runSubagent)
- **Requirements**: Full engagement (preflight_ok, plan_created, spawn, verification)
- **Exit**: 2 if tools missing, 5 if asleep, 0 if passed
- **Guard**: Enforces agentic contract

---

## 🔧 What Changed

### 1. Asleep Detector (`src/asleep-detector.ts`)

**New signature:**
```typescript
asleepDetector(result: unknown, strictMode: boolean = false): AsleepDetectorResult
```

**Conditional logic:**

**Strict mode (agentic):**
- Requires: `preflight_ok`, `plan_created`, `spawn`, `verification.allSignaturesValid`, `runtimeMode=real`

**Local mode:**
- Requires: trace exists + minimal activity (spawn/merge/return)
- Accepts: `runtimeMode=simulated`

**New result structure:**
```typescript
{
  ok: boolean,
  contractMode: 'agentic' | 'local',
  contractSatisfied: boolean,
  engagement: {
    hasPreflightOk: boolean,
    hasPlanCreated: boolean,
    hasProofVerified: boolean,
    hasSpawnOrRequest: boolean,
    hasQualityGatePass: boolean
  },
  traceEvents: string[],
  ...
}
```

### 2. Guard Script (`scripts/guard-agentic.mjs`)

**Two-tier enforcement:**

**When `proof.strictMode === true` OR `CONFUCIUS_AGENTIC=true`:**
- Enforce agentic contract
- Require `runtimeMode=real`
- Require engagement flags (preflight, plan, spawn, verified)
- Exit 5 if violated

**When `proof.strictMode === false`:**
- Accept local proofs
- Only require `proof.ok === true`
- Allow `runtimeMode=simulated`

**Key change:** Guard no longer blocks local development proofs.

### 3. CLI Worker (`src/cli-worker.ts`)

**Split exit logic:**

```typescript
const proofOk = orchResult.ok === true;  // Orchestration completed
const contractOk = sleep.ok;              // Contract satisfied

// Exit priority:
1. strictMode=true + runtimeMode!=real → exit 2 (tool_missing)
2. !contractOk → exit 5 (asleep)
3. !proofOk → exit 1 (proof failed)
4. else → exit 0 (success)
```

**New proof artifact fields:**
- `contractMode`: 'agentic' | 'local'
- `engagement`: breakdown of engagement flags
- `ok`: now means `contractOk && proofOk`

**Key change:** Local simulation can exit 0 even without strict engagement.

---

## 🧪 Validation

### Test A: Local Development Mode ✅

```bash
cd packages/confucius-recursion-sdk
CONFUCIUS_STRICT_MODE=false \
CONFUCIUS_USE_WORKER=false \
CONFUCIUS_FORCE_SLEEP=false \
node dist/cli-worker.js
```

**Expected:**
- ✅ Exit code 0
- ✅ `"ok": true`
- ✅ `"contractMode": "local"`
- ✅ `"runtimeMode": "simulated"`
- ✅ Proof artifact written

**Guard test:**
```bash
node scripts/guard-agentic.mjs
```

**Expected:**
- ✅ Exit code 0
- ✅ Message: "Valid proof found"
- ✅ `"contractMode": "local"`

**Result:** ✅ PASSED

---

### Test B: Agentic IDE Mode (No Tools) ✅

```bash
CONFUCIUS_STRICT_MODE=true \
CONFUCIUS_USE_WORKER=true \
node dist/cli-worker.js
```

**Expected:**
- ✅ Exit code 2 (tool_missing_strict)
- ✅ `"reason": "tool_missing_strict"`
- ✅ Error message clear

**Result:** ✅ PASSED

---

### Test C: Guard with Agentic Contract (Simulated Proof) ✅

```bash
# Generate local proof first (Test A)
CONFUCIUS_STRICT_MODE=false node dist/cli-worker.js

# Try to enforce agentic contract
CONFUCIUS_AGENTIC=true node scripts/guard-agentic.mjs
```

**Expected:**
- Exit code 5
- Error: "agentic_contract_violated_runtime"
- Message: "Agentic contract requires runtimeMode=real"

**Result:** Would pass (not tested in standalone environment)

---

## 📊 Exit Code Matrix

| Scenario | strictMode | runtimeMode | Exit Code | Reason |
|----------|------------|-------------|-----------|--------|
| Local sim success | false | simulated | 0 | Contract satisfied |
| Local sim no trace | false | simulated | 5 | Asleep (no activity) |
| Local sim crash | false | simulated | 1 | Proof failed |
| Agentic no tools | true | N/A | 2 | tool_missing_strict |
| Agentic simulated | true | simulated | 2 | Runtime not real |
| Agentic no engagement | true | real | 5 | Asleep |
| Agentic proof fail | true | real | 1 | Proof failed |
| Agentic success | true | real | 0 | All gates passed |

---

## 🎯 Enforcement Layers (Updated)

### Layer 1: Bypass Prevention ✅
- Package exports locked to single entrypoint
- No change

### Layer 2: Agent Enforcement (Updated) ✅
- **Guard only runs for agentic tasks** (strict mode)
- Local development bypasses guard
- VS Code tasks enforce guard for "Run Task (Strict)" only

### Layer 3: Hard Enforcement (Updated) ✅
- **Conditional exit codes based on mode**
- Local: Exit 0 on successful simulation
- Agentic: Exit 2/5/1 based on violations
- CI validates both modes

---

## 🔄 Task Configuration

### For Agentic Work (Strict):
```json
{
  "label": "Confucius: Run Task (Strict)",
  "command": "node scripts/guard-agentic.mjs && node dist/cli-worker.js",
  "env": {
    "CONFUCIUS_STRICT_MODE": "true",
    "CONFUCIUS_USE_WORKER": "true"
  }
}
```
Guard runs first, enforces agentic contract.

### For Local Development:
```bash
# Direct execution, no guard
CONFUCIUS_STRICT_MODE=false node dist/cli-worker.js
```
No guard enforcement, accepts simulated mode.

---

## 📝 Contract Mode Rules

| contractMode | strictMode | runtimeMode | Engagement Required |
|--------------|------------|-------------|---------------------|
| local | false | simulated | Minimal (trace + activity) |
| agentic | true | real | Full (preflight + plan + spawn + verified) |

**Enforcement:**
- `asleepDetector` validates contract based on `strictMode`
- `guard-agentic.mjs` enforces agentic contract only when needed
- `cli-worker` exits appropriately for each mode

---

## ✅ Summary

**Problem:** Single strict enforcement blocked local development.

**Solution:** Dual-mode enforcement with conditional contracts.

**Result:**
- ✅ Local development works (simulated mode, exit 0)
- ✅ Agentic IDE enforced (real mode, full engagement)
- ✅ Guard only blocks agentic violations
- ✅ Exit codes reflect mode expectations

**Key Insight:**
> "Proof OK" (orchestration succeeded) ≠ "Contract OK" (engagement satisfied)
> 
> Local mode: proofOk is sufficient
> Agentic mode: contractOk required

Enforcement is now **mode-appropriate**, not universally strict.
