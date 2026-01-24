import { z } from 'zod';

export const NoteStatusSchema = z.enum(['open', 'closed']);
export const NoteTypeSchema = z.enum(['finding', 'decision', 'heuristic', 'regression', 'risk', 'todo']);
export const NoteSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);

export const NoteIndexSchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  project: z.object({
    repo: z.string(),
    package: z.string(),
    environment: z.enum(['local', 'ci', 'production'])
  }),
  stats: z.object({
    totalNotes: z.number(),
    openNotes: z.number(),
    closedNotes: z.number(),
    lastNoteId: z.string()
  }),
  files: z.object({
    notesDir: z.string(),
    entries: z.array(z.object({
      noteId: z.string(),
      createdAtMs: z.number(),
      status: NoteStatusSchema,
      type: NoteTypeSchema,
      severity: NoteSeveritySchema,
      title: z.string(),
      tags: z.array(z.string()),
      proofArtifactPath: z.string().optional()
    }))
  })
});

export const NoteEntrySchema = z.object({
  schemaVersion: z.literal('1.0.0'),
  noteId: z.string(),
  createdAtMs: z.number(),
  updatedAtMs: z.number(),
  status: NoteStatusSchema,
  type: NoteTypeSchema,
  severity: NoteSeveritySchema,
  title: z.string(),
  summary: z.string(),
  context: z.object({
    contractMode: z.enum(['local', 'agentic']),
    runtimeMode: z.enum(['real', 'simulated']),
    strictMode: z.boolean(),
    useWorker: z.boolean(),
    task: z.string(),
    environment: z.object({
      os: z.string(),
      node: z.string(),
      ide: z.string().optional()
    })
  }),
  links: z.object({
    proofArtifactPath: z.string().optional(),
    traceRunIds: z.array(z.string()),
    commit: z.string().optional(),
    pr: z.string().optional()
  }),
  signals: z.object({
    tags: z.array(z.string()),
    components: z.array(z.string()),
    relatedNoteIds: z.array(z.string())
  }),
  evidence: z.object({
    symptoms: z.array(z.string()),
    reproduction: z.object({
      steps: z.array(z.string()),
      expected: z.string(),
      actual: z.string()
    }).optional(),
    artifacts: z.array(z.object({
      kind: z.enum(['log', 'trace', 'error', 'diff', 'config']),
      text: z.string(),
      path: z.string().optional()
    }))
  }),
  decision: z.object({
    rootCause: z.string(),
    fix: z.string(),
    tradeoffs: z.array(z.string()),
    confidence: z.number().min(0).max(1)
  }).optional(),
  actions: z.object({
    todos: z.array(z.object({
      id: z.string(),
      text: z.string(),
      status: z.enum(['open', 'done', 'wontfix'])
    })),
    followUps: z.array(z.object({
      id: z.string(),
      text: z.string(),
      status: z.enum(['open', 'done', 'wontfix'])
    }))
  }),
  history: z.array(z.object({
    atMs: z.number(),
    event: z.enum(['created', 'updated', 'closed', 'reopened', 'linked']),
    by: z.string(),
    detail: z.string().optional()
  }))
});

export type NoteIndex = z.infer<typeof NoteIndexSchema>;
export type NoteEntry = z.infer<typeof NoteEntrySchema>;
export type NoteStatus = z.infer<typeof NoteStatusSchema>;
export type NoteType = z.infer<typeof NoteTypeSchema>;
export type NoteSeverity = z.infer<typeof NoteSeveritySchema>;
