#!/usr/bin/env node
/**
 * Confucius CLI - Asleep Detector Test Harness
 * 
 * Runs a task and validates engagement evidence.
 * Exits with code 5 if ASLEEP DETECTED.
 */

import process from "node:process";
import { RecursionProofOrchestratorHardened } from "./orchestrator/hardened-orchestrator.js";

function getBoolEnv(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (!v) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

function hasAnyKind(trace: any[], kinds: string[]): boolean {
  return trace.some((e) => kinds.includes(e.kind));
}

/**
 * Asleep Detector Contract
 * 
 * Engaged = ALL conditions true:
 * - trace contains preflight_ok
 * - trace contains plan_created
 * - trace contains at least one of: spawn, spawn_request_detected, merge, quality_gate_pass
 * - verification.allSignaturesValid true
 * 
 * Asleep = ANY condition missing
 */
export interface AsleepDetectorResult {
  ok: boolean;
  traceCount: number;
  verificationOk: boolean;
  hasPreflightOk: boolean;
  hasPlanCreated: boolean;
  hasEngagement: boolean;
  traceEvents: string[];
}

export function asleepDetector(result: unknown): AsleepDetectorResult {
  const trace = Array.isArray((result as any)?.trace) ? (result as any).trace : [];
  const verificationOk = (result as any)?.verification?.allSignaturesValid === true;

  const hasPreflightOk = hasAnyKind(trace, ["preflight_ok"]);
  const hasPlanCreated = hasAnyKind(trace, ["plan_created"]);
  const hasEngagement =
    hasAnyKind(trace, ["spawn"]) ||
    hasAnyKind(trace, ["spawn_request_detected"]) ||
    hasAnyKind(trace, ["merge"]) ||
    hasAnyKind(trace, ["quality_gate_pass"]);

  const ok = hasPreflightOk && hasPlanCreated && hasEngagement && verificationOk;

  return {
    ok,
    traceCount: trace.length,
    verificationOk,
    hasPreflightOk,
    hasPlanCreated,
    hasEngagement,
    traceEvents: trace.map((e: any) => e.kind)
  };
}

async function main() {
  const strictMode = getBoolEnv("CONFUCIUS_STRICT_MODE", false);
  const forceSleep = getBoolEnv("CONFUCIUS_FORCE_SLEEP", false);

  const orch = new RecursionProofOrchestratorHardened({
    maxDepth: 4,
    maxSpawns: 10,
    strictMode,
    forceSleep  // Pass to orchestrator for intentional failure mode
  });

  const result = await orch.runDepth3Proof();

  const sleep = asleepDetector(result);

  const out = {
    ok: result?.ok === true && sleep.ok === true,
    runtimeMode: result?.runtimeMode || "unknown",
    strictMode,
    forceSleep,
    asleepDetector: sleep,
    verification: result?.verification || null,
    deepestDepthReached: result?.deepestDepthReached || 0,
    spawnsExecuted: result?.spawnsExecuted || 0
  };

  // JSON only output
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");

  // Exit codes
  if (!sleep.ok) {
    console.error("\n⚠️  ASLEEP DETECTED: No engagement evidence!");
    process.exit(5);
  }
  if (result?.ok !== true) {
    console.error("\n✗ Proof failed");
    process.exit(1);
  }
  
  console.log("\n✓ Engagement verified - agent awake");
  process.exit(0);
}

main().catch((err) => {
  const out = { ok: false, reason: "cli_crash", error: String(err?.message || err) };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  process.exit(2);
});

