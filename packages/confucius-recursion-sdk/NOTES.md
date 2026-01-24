# Notes System (F2: Persistent Memory)

The Confucius SDK includes a persistent note-taking system that implements F2 from the white paper. This system automatically captures failures, maintains structured knowledge across sessions, and provides queryable observability without polluting the agent's reasoning context (AX).

## Architecture Principles

### AX/UX/DX Separation

- **AX (Agent Experience)**: Notes live **outside** the agent's prompt and memory. They never pollute reasoning context.
- **UX (User Experience)**: Notes export to human-readable Markdown for transparency and interpretability.
- **DX (Developer Experience)**: Notes provide structured observability with queryable tags, components, and severity levels.

### Design Goals

1. **Append-only**: Notes are immutable once created. History is never rewritten.
2. **Task-linked**: Every note traces back to proof artifacts, trace events, and git commits.
3. **Auto-capture**: Failures automatically generate notes without manual intervention.
4. **Queryable**: Filter notes by status, type, severity, tags, or components.
5. **Model-agnostic**: JSON schema works with any LLM or agent framework.

## Note Structure

### Index File

`.confucius/notes/index.json` - Central registry of all notes

```json
{
  "schemaVersion": "1.0.0",
  "createdAtMs": 1737712648475,
  "updatedAtMs": 1737712648475,
  "project": {
    "repo": "Aldine/confucius-vision-scafolding-sdk",
    "package": "@aldine/confucius-recursion-sdk",
    "environment": "local"
  },
  "stats": {
    "totalNotes": 1,
    "openNotes": 1,
    "closedNotes": 0,
    "lastNoteId": "note_20260124105728_3db1"
  },
  "files": {
    "notesDir": ".confucius/notes",
    "entries": [...]
  }
}
```

### Note Entry

`.confucius/notes/note_YYYYMMDD_HHMMSS_<shortid>.json` - Individual note

```json
{
  "noteId": "note_20260124105728_3db1",
  "status": "open",
  "type": "finding",
  "severity": "critical",
  "title": "Strict mode failed: runSubagent not available",
  "summary": "Captured from automatic failure detection. Exit code: 2",
  "context": {
    "contractMode": "agentic",
    "runtimeMode": "simulated",
    "strictMode": true,
    "useWorker": true,
    "task": "Test auto-capture"
  },
  "links": {
    "proofArtifactPath": ".confucius/last-proof.json",
    "traceRunIds": [],
    "commit": "554930b...",
    "pr": null
  },
  "signals": {
    "tags": ["exit-2", "agentic", "simulated"],
    "components": ["cli-worker", "orchestrator"],
    "relatedNoteIds": []
  },
  "evidence": {
    "symptoms": [
      "Exit code 2",
      "CONFUCIUS_STRICT_MODE=true",
      "runSubagent undefined"
    ],
    "reproduction": {
      "steps": [
        "export CONFUCIUS_STRICT_MODE=true",
        "export CONFUCIUS_USE_WORKER=true",
        "node dist/cli-worker.js"
      ],
      "expected": "Exit code 0 with valid proof",
      "actual": "Exit code 2"
    },
    "artifacts": []
  },
  "decision": {
    "rootCause": "Agent configured for strict agentic mode but runSubagent tool not provided",
    "fix": "Provide runSubagent implementation or switch to local mode",
    "tradeoffs": [],
    "confidence": 0.7
  },
  "actions": {
    "todos": [
      { "id": "todo_1", "text": "Review proof artifact and trace", "status": "open" }
    ],
    "followUps": []
  },
  "history": [
    {
      "atMs": 1737712648475,
      "event": "created",
      "by": "confucius",
      "detail": "Test auto-capture"
    }
  ]
}
```

## CLI Commands

### List Notes

```bash
node bin/confucius-notes.mjs list

# Filter by status
node bin/confucius-notes.mjs list --status open

# Filter by type
node bin/confucius-notes.mjs list --type regression

# Filter by severity
node bin/confucius-notes.mjs list --severity critical

# Filter by tags
node bin/confucius-notes.mjs list --tags exit-5,asleep

# Filter by components
node bin/confucius-notes.mjs list --components orchestrator
```

### Show Note Details

```bash
# Full note ID
node bin/confucius-notes.mjs show note_20260124105728_3db1

# Short ID (partial match)
node bin/confucius-notes.mjs show 20260124105728
```

### Close Note

```bash
node bin/confucius-notes.mjs close 20260124105728 --resolution "Fixed by adding runSubagent adapter"
```

### Show Statistics

```bash
node bin/confucius-notes.mjs stats
```

### Export to Markdown

```bash
# Print to stdout
node bin/confucius-notes.mjs export 20260124105728

# Save to file
node bin/confucius-notes.mjs export 20260124105728 note.md
```

## Auto-Capture Triggers

Notes are automatically captured when:

- **Exit code 5**: Agent asleep (no engagement detected)
- **Exit code 2**: Strict mode failed (runSubagent missing)
- **Exit code 1**: Proof validation failed
- **CLI crash**: Unhandled exceptions

Example captured note after asleep detection:

```bash
$ CONFUCIUS_STRICT_MODE=true node dist/cli-worker.js
# ... agent runs but doesn't engage ...
📝 Note captured: note_20260124110245_a7f4
```

## Schema Enums

### Status

- `open`: Note is active and unresolved
- `closed`: Note is resolved or no longer relevant

### Type

- `finding`: Newly discovered issue or behavior
- `decision`: Architectural or design decision
- `heuristic`: Learned pattern or rule of thumb
- `regression`: Previously working functionality broke
- `risk`: Potential future issue
- `todo`: Action item or follow-up task

### Severity

- `low`: Minor issue, cosmetic or documentation
- `medium`: Moderate impact, workaround available
- `high`: Significant impact, blocks some workflows
- `critical`: Severe impact, blocks core functionality

## Programmatic API

### Initialize Note Manager

```typescript
import { NoteManager } from '@aldine/confucius-recursion-sdk/notes/manager';

const manager = new NoteManager('.confucius/notes');
await manager.init({
  repo: 'Aldine/confucius-vision-scafolding-sdk',
  package: '@aldine/confucius-recursion-sdk',
  environment: 'local'
});
```

### Create Note

```typescript
const noteId = await manager.createNote({
  schemaVersion: '1.0.0',
  status: 'open',
  type: 'finding',
  severity: 'high',
  title: 'Worker mode fallback produced undefined output',
  summary: 'Standalone mode used worker orchestration without runSubagent',
  context: {
    contractMode: 'local',
    runtimeMode: 'simulated',
    strictMode: false,
    useWorker: true,
    task: 'test',
    environment: {
      os: 'windows',
      node: '20.x'
    }
  },
  links: {
    proofArtifactPath: '.confucius/last-proof.json',
    traceRunIds: [],
    commit: '554930b'
  },
  signals: {
    tags: ['worker', 'adapter', 'simulation'],
    components: ['worker-manager', 'orchestrator'],
    relatedNoteIds: []
  },
  evidence: {
    symptoms: ["Cannot use 'in' operator to search for 'spawn_requests' in undefined"],
    reproduction: {
      steps: [
        'set CONFUCIUS_USE_WORKER=true',
        'set CONFUCIUS_STRICT_MODE=false',
        'node dist/cli-worker.js'
      ],
      expected: 'Fallback to non-worker simulation, exit 0',
      actual: 'Worker path ran and failed inside quality gate'
    },
    artifacts: []
  },
  decision: {
    rootCause: 'Worker mode invoked without real runSubagent',
    fix: 'Disable worker when runSubagent missing',
    tradeoffs: ['Worker mode limited to real runtimes'],
    confidence: 0.9
  },
  actions: {
    todos: [
      { id: 'todo_1', text: 'Add contract-aware asleep detector', status: 'done' }
    ],
    followUps: [
      { id: 'fu_1', text: 'Add notes auto-append on guard failure', status: 'open' }
    ]
  }
});

console.log('Note created:', noteId);
```

### Query Notes

```typescript
// Find all open critical findings
const notes = await manager.queryNotes({
  status: 'open',
  severity: 'critical',
  type: 'finding'
});

// Find notes by tags
const workerNotes = await manager.queryNotes({
  tags: ['worker', 'adapter']
});

// Find notes by components
const orchNotes = await manager.queryNotes({
  components: ['orchestrator']
});
```

### Update Note

```typescript
await manager.updateNote(noteId, {
  status: 'closed',
  decision: {
    rootCause: 'Updated analysis...',
    fix: 'Implemented solution...',
    tradeoffs: ['Trade-off 1', 'Trade-off 2'],
    confidence: 0.95
  }
});
```

### Export Markdown

```typescript
const markdown = await manager.exportMarkdown(noteId);
console.log(markdown);
```

## Integration with VS Code Tasks

Add to `.vscode/tasks.json`:

```json
{
  "label": "Confucius: Review Recent Notes",
  "type": "shell",
  "command": "node",
  "args": [
    "bin/confucius-notes.mjs",
    "list",
    "--status", "open"
  ],
  "options": {
    "cwd": "${workspaceFolder}/../confucius-vision-scafolding-sdk/packages/confucius-recursion-sdk"
  },
  "problemMatcher": [],
  "presentation": {
    "reveal": "always",
    "panel": "new"
  }
}
```

## Best Practices

### When to Create Notes

- **Auto-captured**: All exit codes ≠ 0
- **Manual**: Architectural decisions, learned heuristics, risks
- **Hindsight**: After resolving complex issues, document the journey

### Tagging Strategy

Use hierarchical tags:
- **Scope**: `exit-5`, `worker`, `orchestrator`, `adapter`
- **Mode**: `agentic`, `local`, `simulated`, `real`
- **Phase**: `build`, `test`, `runtime`, `deploy`

### Linking Notes

Use `relatedNoteIds` to build knowledge graphs:

```typescript
// Link follow-up note to original
await manager.createNote({
  ...note,
  signals: {
    tags: ['follow-up'],
    components: ['orchestrator'],
    relatedNoteIds: ['note_20260124105728_3db1']
  }
});
```

### Archiving

For long-running projects, archive closed notes older than 90 days:

```typescript
import { archiveOldNotes } from '@aldine/confucius-recursion-sdk/notes/archival';

await archiveOldNotes(manager, 90); // Archive notes older than 90 days
```

## Future Enhancements

- **Vector search**: Semantic similarity queries over note content
- **Auto-linking**: ML-based detection of related notes
- **Trend analysis**: Aggregate failure patterns over time
- **Export formats**: PDF, HTML, Confluence, GitHub Issues
- **Note templates**: Predefined structures for common scenarios

## White Paper Alignment

This notes system implements **F2 (Persistent Memory)** from the Confucius SDK white paper:

> "A dedicated note-taking agent distills trajectories into persistent, hierarchical Markdown notes, including hindsight notes capturing failure modes—supporting both durable knowledge for the agent (AX) and interpretable artifacts for humans (UX)."

Key differences from traditional logs:
- **Structured**: JSON schema with typed fields
- **Persistent**: Survives across sessions
- **Queryable**: Filter by multiple dimensions
- **Append-only**: Immutable history
- **Task-linked**: Traces to proof artifacts and commits
- **Confidence-scored**: AI-friendly retrieval signals

Notes live **outside the brain** (AX clean), provide **structured observability** (DX strong), and export to **human-readable formats** (UX clear).
