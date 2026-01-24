import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { NoteEntry, NoteIndex, NoteStatus, NoteType, NoteSeverity } from './schema.js';
import { NoteEntrySchema, NoteIndexSchema } from './schema.js';

export class NoteManager {
  private notesDir: string;
  private indexPath: string;

  constructor(baseDir: string = '.confucius/notes') {
    this.notesDir = baseDir;
    this.indexPath = path.join(baseDir, 'index.json');
  }

  async init(project: { repo: string; package: string; environment: string }): Promise<void> {
    await fs.mkdir(this.notesDir, { recursive: true });
    
    try {
      await fs.access(this.indexPath);
    } catch {
      const index: NoteIndex = {
        schemaVersion: '1.0.0',
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        project: project as NoteIndex['project'],
        stats: {
          totalNotes: 0,
          openNotes: 0,
          closedNotes: 0,
          lastNoteId: ''
        },
        files: {
          notesDir: this.notesDir,
          entries: []
        }
      };
      await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
    }
  }

  async createNote(draft: Omit<NoteEntry, 'noteId' | 'createdAtMs' | 'updatedAtMs' | 'history'>): Promise<string> {
    const now = Date.now();
    const shortId = crypto.randomBytes(2).toString('hex');
    const timestamp = new Date(now).toISOString().replace(/[-:T]/g, '').slice(0, 15);
    const noteId = `note_${timestamp}_${shortId}`;

    const note: NoteEntry = {
      ...draft,
      noteId,
      createdAtMs: now,
      updatedAtMs: now,
      history: [
        {
          atMs: now,
          event: 'created',
          by: 'confucius',
          detail: draft.context.task || 'auto-generated note'
        }
      ]
    };

    // Validate schema
    NoteEntrySchema.parse(note);

    // Write note file
    const notePath = path.join(this.notesDir, `${noteId}.json`);
    await fs.writeFile(notePath, JSON.stringify(note, null, 2));

    // Update index
    await this.updateIndex(index => {
      index.files.entries.push({
        noteId,
        createdAtMs: now,
        status: note.status,
        type: note.type,
        severity: note.severity,
        title: note.title,
        tags: note.signals.tags,
        proofArtifactPath: note.links.proofArtifactPath
      });
      index.stats.totalNotes++;
      if (note.status === 'open') index.stats.openNotes++;
      index.stats.lastNoteId = noteId;
      index.updatedAtMs = now;
    });

    return noteId;
  }

  async updateNote(noteId: string, updates: Partial<Pick<NoteEntry, 'status' | 'decision' | 'actions'>>): Promise<void> {
    const notePath = path.join(this.notesDir, `${noteId}.json`);
    const content = await fs.readFile(notePath, 'utf-8');
    const note: NoteEntry = JSON.parse(content);

    const now = Date.now();
    const updated: NoteEntry = {
      ...note,
      ...updates,
      updatedAtMs: now,
      history: [
        ...note.history,
        {
          atMs: now,
          event: 'updated',
          by: 'confucius',
          detail: `Updated: ${Object.keys(updates).join(', ')}`
        }
      ]
    };

    NoteEntrySchema.parse(updated);
    await fs.writeFile(notePath, JSON.stringify(updated, null, 2));

    // Update index if status changed
    if (updates.status && updates.status !== note.status) {
      await this.updateIndex(index => {
        const entry = index.files.entries.find(e => e.noteId === noteId);
        if (entry) {
          if (note.status === 'open') index.stats.openNotes--;
          if (updates.status === 'open') index.stats.openNotes++;
          if (note.status === 'closed') index.stats.closedNotes--;
          if (updates.status === 'closed') index.stats.closedNotes++;
          if (updates.status) entry.status = updates.status;
        }
        index.updatedAtMs = now;
      });
    }
  }

  async closeNote(noteId: string, resolution: string): Promise<void> {
    const notePath = path.join(this.notesDir, `${noteId}.json`);
    const content = await fs.readFile(notePath, 'utf-8');
    const note: NoteEntry = JSON.parse(content);

    const now = Date.now();
    const closed: NoteEntry = {
      ...note,
      status: 'closed',
      updatedAtMs: now,
      history: [
        ...note.history,
        {
          atMs: now,
          event: 'closed',
          by: 'confucius',
          detail: resolution
        }
      ]
    };

    await fs.writeFile(notePath, JSON.stringify(closed, null, 2));

    await this.updateIndex(index => {
      const entry = index.files.entries.find(e => e.noteId === noteId);
      if (entry) {
        entry.status = 'closed';
        index.stats.openNotes--;
        index.stats.closedNotes++;
      }
      index.updatedAtMs = now;
    });
  }

  private async updateIndex(updater: (index: NoteIndex) => void): Promise<void> {
    const content = await fs.readFile(this.indexPath, 'utf-8');
    const index: NoteIndex = JSON.parse(content);
    updater(index);
    NoteIndexSchema.parse(index);
    await fs.writeFile(this.indexPath, JSON.stringify(index, null, 2));
  }

  async getNote(noteId: string): Promise<NoteEntry | null> {
    try {
      const notePath = path.join(this.notesDir, `${noteId}.json`);
      const content = await fs.readFile(notePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async queryNotes(filters: {
    tags?: string[];
    status?: NoteStatus;
    type?: NoteType;
    severity?: NoteSeverity;
    components?: string[];
  }): Promise<NoteEntry[]> {
    const index = await this.getIndex();
    const results: NoteEntry[] = [];

    for (const entry of index.files.entries) {
      let match = true;
      
      if (filters.status && entry.status !== filters.status) match = false;
      if (filters.type && entry.type !== filters.type) match = false;
      if (filters.severity && entry.severity !== filters.severity) match = false;
      if (filters.tags && !filters.tags.some(t => entry.tags.includes(t))) match = false;

      if (match) {
        const note = await this.getNote(entry.noteId);
        if (note) {
          if (filters.components && !filters.components.some(c => note.signals.components.includes(c))) {
            continue;
          }
          results.push(note);
        }
      }
    }

    return results;
  }

  async getIndex(): Promise<NoteIndex> {
    const content = await fs.readFile(this.indexPath, 'utf-8');
    return JSON.parse(content);
  }

  async exportMarkdown(noteId: string): Promise<string> {
    const note = await this.getNote(noteId);
    if (!note) throw new Error(`Note ${noteId} not found`);

    const md = [
      `# ${note.title}`,
      '',
      `**Status:** ${note.status} | **Type:** ${note.type} | **Severity:** ${note.severity}`,
      `**Created:** ${new Date(note.createdAtMs).toISOString()}`,
      '',
      '## Summary',
      note.summary,
      '',
      '## Context',
      `- Contract Mode: ${note.context.contractMode}`,
      `- Runtime Mode: ${note.context.runtimeMode}`,
      `- Strict Mode: ${note.context.strictMode}`,
      `- Worker: ${note.context.useWorker}`,
      `- Task: ${note.context.task}`,
      '',
      '## Evidence',
      '### Symptoms',
      ...note.evidence.symptoms.map(s => `- ${s}`),
      ''
    ];

    if (note.evidence.reproduction) {
      md.push(
        '### Reproduction',
        '```bash',
        ...note.evidence.reproduction.steps,
        '```',
        `**Expected:** ${note.evidence.reproduction.expected}`,
        `**Actual:** ${note.evidence.reproduction.actual}`,
        ''
      );
    }

    if (note.decision) {
      md.push(
        '## Decision',
        `**Root Cause:** ${note.decision.rootCause}`,
        '',
        `**Fix:** ${note.decision.fix}`,
        '',
        '**Tradeoffs:**',
        ...note.decision.tradeoffs.map(t => `- ${t}`),
        '',
        `**Confidence:** ${(note.decision.confidence * 100).toFixed(0)}%`,
        ''
      );
    }

    if (note.actions.todos.length > 0) {
      md.push(
        '## Actions',
        '### TODOs',
        ...note.actions.todos.map(t => `- [${t.status === 'done' ? 'x' : ' '}] ${t.text}`),
        ''
      );
    }

    md.push(
      '## Tags',
      note.signals.tags.map(t => `#${t}`).join(' '),
      '',
      '## Components',
      note.signals.components.map(c => `\`${c}\``).join(', ')
    );

    return md.join('\n');
  }
}
