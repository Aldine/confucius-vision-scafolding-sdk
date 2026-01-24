import type { NoteManager } from './manager.js';
import type { NoteEntry } from './schema.js';
import { tryDedupeFailure } from './dedupe.js';
import os from 'os';
import { execSync } from 'child_process';
import { resolve } from 'node:path';

export async function captureFailureNote(
  manager: NoteManager,
  exitCode: number,
  context: {
    task: string;
    strictMode: boolean;
    useWorker: boolean;
    contractMode: 'local' | 'agentic';
    runtimeMode: 'real' | 'simulated';
    error?: Error;
    proofPath?: string;
    traceRunIds?: string[];
    notesDir?: string;
  }
): Promise<string> {
  let title: string;
  let type: NoteEntry['type'];
  let severity: NoteEntry['severity'];
  let symptoms: string[] = [];
  let rootCause = '';
  let fix = '';

  switch (exitCode) {
    case 5: // Asleep
      title = 'Agent asleep: No meaningful engagement detected';
      type = 'regression';
      severity = 'high';
      symptoms = ['Exit code 5', 'Asleep detector triggered', 'No spawn or tool events in trace'];
      rootCause = 'Agent completed without executing any tools or spawning sub-agents. Likely prompt issue or task misunderstanding.';
      fix = 'Review task prompt. Check if agent has access to required tools. Verify runSubagent availability in strict mode.';
      break;

    case 2: // Tool missing (strict)
      title = 'Strict mode failed: runSubagent not available';
      type = 'finding';
      severity = 'critical';
      symptoms = ['Exit code 2', 'CONFUCIUS_STRICT_MODE=true', 'runSubagent undefined'];
      rootCause = 'Agent configured for strict agentic mode but runSubagent tool not provided via SpawnAdapter.';
      fix = 'Provide runSubagent implementation or switch to local mode (CONFUCIUS_STRICT_MODE=false).';
      break;

    case 1: // Proof validation failed
      title = 'Proof validation failed: Quality gate rejected output';
      type = 'regression';
      severity = 'high';
      symptoms = context.error ? [context.error.message] : ['Exit code 1', 'Proof generation failed'];
      rootCause = context.error?.message || 'Unknown validation failure';
      fix = 'Check proof artifact structure. Verify all required fields present. Review trace for malformed events.';
      break;

    default:
      title = `Unknown failure: Exit code ${exitCode}`;
      type = 'finding';
      severity = 'medium';
      symptoms = [`Unexpected exit code: ${exitCode}`];
      rootCause = 'Unknown failure mode';
      fix = 'Review logs and trace events';
  }

  const draft: Omit<NoteEntry, 'noteId' | 'createdAtMs' | 'updatedAtMs' | 'history'> = {
    schemaVersion: '1.0.0',
    status: 'open',
    type,
    severity,
    title,
    summary: `Captured from automatic failure detection. Exit code: ${exitCode}`,
    context: {
      contractMode: context.contractMode,
      runtimeMode: context.runtimeMode,
      strictMode: context.strictMode,
      useWorker: context.useWorker,
      task: context.task,
      environment: {
        os: os.platform(),
        node: process.version,
        ide: process.env.TERM_PROGRAM || 'unknown'
      }
    },
    links: {
      proofArtifactPath: context.proofPath,
      traceRunIds: context.traceRunIds || [],
      commit: getGitCommit(),
      pr: undefined
    },
    signals: {
      tags: [`exit-${exitCode}`, context.contractMode, context.runtimeMode],
      components: ['cli-worker', 'orchestrator'],
      relatedNoteIds: []
    },
    evidence: {
      symptoms,
      reproduction: {
        steps: [
          `export CONFUCIUS_STRICT_MODE=${context.strictMode}`,
          `export CONFUCIUS_USE_WORKER=${context.useWorker}`,
          `export CONFUCIUS_TASK="${context.task}"`,
          'node dist/cli-worker.js'
        ],
        expected: 'Exit code 0 with valid proof',
        actual: `Exit code ${exitCode}`
      },
      artifacts: context.error ? [
        { kind: 'error', text: context.error.stack || context.error.message }
      ] : []
    },
    decision: {
      rootCause,
      fix,
      tradeoffs: [],
      confidence: 0.7
    },
    actions: {
      todos: [
        { id: 'todo_1', text: 'Review proof artifact and trace', status: 'open' },
        { id: 'todo_2', text: 'Verify fix resolves issue', status: 'open' }
      ],
      followUps: []
    }
  };

  // Try dedupe first if notesDir provided
  if (context.notesDir) {
    const dedupe = tryDedupeFailure({
      notesDirAbs: resolve(context.notesDir),
      fingerprint: {
        title,
        summary: draft.summary,
        exitCode,
        contractMode: context.contractMode,
        runtimeMode: context.runtimeMode
      },
      proofPath: context.proofPath || 'unknown',
      taskText: context.task
    });

    if (dedupe.deduped) {
      return dedupe.noteId;
    }
  }

  return manager.createNote(draft);
}

function getGitCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}
