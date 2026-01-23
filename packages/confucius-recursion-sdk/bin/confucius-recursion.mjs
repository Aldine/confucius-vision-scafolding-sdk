#!/usr/bin/env node
/**
 * Confucius Run CLI - MANDATORY ENGAGEMENT ENFORCER
 * 
 * This is the intrusion point that prevents "asleep" mode.
 * Use this CLI instead of direct model/agent calls in agentic IDEs.
 * 
 * What this enforces:
 * - Preflight gate runs first
 * - Every task produces signed trace
 * - Asleep detection (fails if no plan/spawn/gate evidence)
 * - Strict mode auto-enabled in agentic IDEs
 * - No silent downgrades
 * 
 * Usage:
 *   confucius-run [options]
 * 
 * Options:
 *   --depth <n>        Max depth (default: 4)
 *   --spawns <n>       Max spawns (default: 10)
 *   --strict           Force strict mode (auto-detected by default)
 *   --no-strict        Disable strict mode (allow simulation)
 *   --output <file>    Write proof JSON to file
 *   --verbose          Enable verbose logging
 *   --help             Show this help
 * 
 * Exit codes:
 *   0 - Task succeeded with engagement evidence
 *   1 - Task failed (general)
 *   2 - Strict mode violation (tool missing in agentic IDE)
 *   3 - Signature verification failed
 *   4 - Quality gate failed
 *   5 - ASLEEP DETECTED (no engagement evidence)
 */

import { runWithConfucius } from '../dist/runWithConfucius.js';
import { writeFileSync } from 'fs';

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    maxDepth: 4,
    maxSpawns: 10,
    strictMode: undefined, // Let adapter auto-detect unless explicitly set
    outputFile: null,
    verbose: false,
    help: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case '--depth':
        config.maxDepth = parseInt(next, 10);
        i++;
        break;
      case '--spawns':
        config.maxSpawns = parseInt(next, 10);
        i++;
        break;
      case '--strict':
        config.strictMode = true;
        break;
      case '--no-strict':
        config.strictMode = false;
        break;
      case '--output':
        config.outputFile = next;
        i++;
        break;
      case '--verbose':
        config.verbose = true;
        break;
      case '--help':
        config.help = true;
        break;
      default:
        if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`);
          process.exit(3);
        }
    }
  }

  return config;
}

// Show help text
function showHelp() {
  console.log(`
Confucius Run CLI - Mandatory Engagement Enforcer

THE INTRUSION POINT: Use this instead of direct model/agent calls.
Prevents "asleep" mode by enforcing preflight gates and engagement detection.

Usage:
  confucius-run [options]

Options:
  --depth <n>        Max depth (default: 4)
  --spawns <n>       Max spawns (default: 10)
  --strict           Force strict mode ON (no simulation fallback)
  --no-strict        Force strict mode OFF (allow simulation)
  --output <file>    Write proof JSON to file
  --verbose          Enable verbose logging
  --help             Show this help

Environment Variables:
  CONFUCIUS_SUPERVISOR_SECRET  Base64-encoded 32-byte secret for signing
  CONFUCIUS_RUNTIME            Set to 'agentic' for IDE integration
  CONFUCIUS_STRICT_MODE        Set to 'true' to force strict mode
  COPILOT_AGENTIC              Auto-detected Copilot agentic runtime
  VSCODE_PID                   Auto-detected VS Code process

Strict Mode Auto-Detection:
  Strict mode is automatically enabled when TWO or more signals detected:
  - COPILOT_AGENTIC=true
  - VSCODE_PID exists
  - TERM_PROGRAM=vscode
  - runSubagent tool available

  Use --strict or --no-strict to override auto-detection.

Exit codes:
  0 - Task succeeded with engagement evidence
  1 - Task failed (general)
  2 - Strict mode violation (runSubagent missing in agentic IDE)
  3 - Signature verification failed
  4 - Quality gate failed
  5 - ASLEEP DETECTED (no plan, spawn, or gate evidence)

Examples:
  # Auto-detect strict mode (recommended in agentic IDE)
  confucius-run --depth 3

  # Force strict mode ON (fail if runSubagent missing)
  confucius-run --depth 3 --strict

  # Allow simulation mode (testing/standalone)
  confucius-run --depth 3 --no-strict

  # Run in agentic IDE with full engagement tracking
  COPILOT_AGENTIC=true confucius-run --depth 3 --output proof.json
  `);
}

// Main execution
async function main() {
  const config = parseArgs();

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  if (config.verbose) {
    console.log('Configuration:', JSON.stringify(config, null, 2));
    console.log('Environment:');
    console.log('  CONFUCIUS_RUNTIME:', process.env.CONFUCIUS_RUNTIME || '(not set)');
    console.log('  CONFUCIUS_STRICT_MODE:', process.env.CONFUCIUS_STRICT_MODE || '(not set)');
    console.log('  CONFUCIUS_SUPERVISOR_SECRET:', process.env.CONFUCIUS_SUPERVISOR_SECRET ? '(set)' : '(not set)');
    console.log('  COPILOT_AGENTIC:', process.env.COPILOT_AGENTIC || '(not set)');
    console.log('  VSCODE_PID:', process.env.VSCODE_PID || '(not set)');
    console.log();
  }

  try {
    // Run with Confucius - THE ONLY ENTRYPOINT
    const result = await runWithConfucius(
      { input: { depth: 0, maxDepth: config.maxDepth } },
      {
        strictMode: config.strictMode,
        maxDepth: config.maxDepth,
        maxSpawns: config.maxSpawns
      }
    );

    // Write output file if requested
    if (config.outputFile) {
      writeFileSync(config.outputFile, JSON.stringify(result, null, 2));
      console.log(`\nProof written to: ${config.outputFile}`);
    }

    // Log engagement evidence
    console.log('\n' + '='.repeat(80));
    console.log('ENGAGEMENT EVIDENCE');
    console.log('='.repeat(80));
    console.log(`✓ Preflight: ${result.engagement.preflight}`);
    console.log(`✓ Had Plan: ${result.engagement.hadPlan}`);
    console.log(`✓ Had Spawn: ${result.engagement.hadSpawn}`);
    console.log(`✓ Had Quality Gate: ${result.engagement.hadQualityGate}`);
    console.log('='.repeat(80));

    // Determine exit code based on result
    if (!result.ok) {
      console.error('\n✗ Task failed:', result.reason);
      
      // Check specific failure reasons for exit codes
      if (result.reason === 'tool_missing_strict') {
        process.exit(2); // Strict mode violation
      } else if (result.reason === 'asleep_detected') {
        console.error('\n⚠️  ASLEEP DETECTED: No engagement evidence!');
        console.error('Agent ran but produced no plan, spawn, or quality gate.');
        console.error('This indicates the agent bypassed Confucius orchestration.');
        process.exit(5); // Asleep detected
      } else if (result.result && !result.result.verification.allSignaturesValid) {
        process.exit(3); // Signature verification failed
      } else if (result.reason === 'quality_gate_failed') {
        process.exit(4); // Quality gate failed
      } else {
        process.exit(1); // General proof failure
      }
    }

    console.log('\n✓ Task succeeded with engagement evidence');
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Execution error:', error.message);
    if (config.verbose && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
