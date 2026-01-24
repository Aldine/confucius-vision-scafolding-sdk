import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

type NoteEntry = {
  noteId: string
  createdAtMs: number
  status: 'open' | 'closed'
  type: string
  severity: string
  title: string
  tags: string[]
  proofArtifactPath: string
}

type NotesIndex = {
  schemaVersion: string
  createdAtMs: number
  updatedAtMs: number
  stats: { totalNotes: number; openNotes: number; closedNotes: number; lastNoteId: string }
  files: { notesDir: string; entries: NoteEntry[] }
}

type FailureFingerprint = {
  title: string
  summary: string
  exitCode: number
  contractMode: 'agentic' | 'local'
  runtimeMode: 'real' | 'simulated'
}

type NoteFile = {
  noteId: string
  createdAtMs: number
  updatedAtMs: number
  title: string
  summary: string
  severity?: string
  context?: any
  history?: Array<{ atMs: number; event: string; by: string; detail: string }>
  evidence?: any
  signals?: any
}

function safeReadJson<T>(path: string): T | null {
  try {
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8')) as T
  } catch {
    return null
  }
}

function matchesFingerprint(note: NoteFile, fp: FailureFingerprint): boolean {
  const ctx = note.context ?? {}
  return (
    note.title === fp.title &&
    note.summary === fp.summary &&
    Number(ctx.exitCode) === fp.exitCode &&
    ctx.contractMode === fp.contractMode &&
    ctx.runtimeMode === fp.runtimeMode
  )
}

export function tryDedupeFailure(params: {
  notesDirAbs: string
  fingerprint: FailureFingerprint
  proofPath: string
  taskText?: string
  windowMs?: number
}): { deduped: true; noteId: string } | { deduped: false } {
  const { notesDirAbs, fingerprint, proofPath, taskText, windowMs = 10 * 60 * 1000 } = params

  const indexPath = resolve(notesDirAbs, 'index.json')
  const index = safeReadJson<NotesIndex>(indexPath)
  if (!index || !Array.isArray(index.files?.entries)) return { deduped: false }

  const now = Date.now()

  // Only scan a small prefix for speed.
  const candidates = index.files.entries.slice(0, 25)

  for (const e of candidates) {
    if (e.status !== 'open') continue
    if (now - e.createdAtMs > windowMs) continue

    const notePath = resolve(notesDirAbs, `${e.noteId}.json`)
    const note = safeReadJson<NoteFile>(notePath)
    if (!note) continue

    if (!matchesFingerprint(note, fingerprint)) continue

    // DEDUPE HIT: append history to existing note
    const atMs = now
    const history = Array.isArray(note.history) ? note.history : []
    history.push({
      atMs,
      event: 'repeat_failure',
      by: 'confucius-runtime',
      detail: `Deduped failure. proof=${proofPath}${taskText ? ` task=${taskText}` : ''}`
    })

    note.updatedAtMs = atMs
    note.history = history

    // Optional: keep a small evidence trail of last proof references
    const ev = note.evidence && typeof note.evidence === 'object' ? note.evidence : {}
    const refs = Array.isArray(ev.proofRefs) ? ev.proofRefs : []
    refs.push({ atMs, proofPath })
    ev.proofRefs = refs.slice(-20)
    note.evidence = ev

    // Escalate severity after N repeats
    const repeatThreshold = 3
    const windowMsLocal = windowMs
    const recentRepeats = history.filter(
      (h) => h.event === 'repeat_failure' && now - h.atMs <= windowMsLocal
    ).length

    if (recentRepeats >= repeatThreshold) {
      // Escalate severity (only upward)
      const current = note.severity ?? 'low'
      const rank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 }
      const next = 'high'

      if ((rank[current] ?? 0) < rank[next]) {
        note.severity = next
      }

      // Add a tag only once
      const signals = note.signals && typeof note.signals === 'object' ? note.signals : {}
      const tags: string[] = Array.isArray(signals.tags) ? signals.tags : []
      if (!tags.includes('repeated_failure')) tags.push('repeated_failure')
      signals.tags = tags
      note.signals = signals

      // Add an escalation history event only once per window
      const alreadyEscalated = history.some(
        (h) => h.event === 'escalated' && now - h.atMs <= windowMsLocal
      )
      if (!alreadyEscalated) {
        history.push({
          atMs: now,
          event: 'escalated',
          by: 'confucius-runtime',
          detail: `Escalated after ${recentRepeats} repeats within ${Math.round(windowMsLocal / 60000)}m`
        })
      }
    }

    writeFileSync(notePath, JSON.stringify(note, null, 2), 'utf8')

    // Update index timestamp so you can see activity
    index.updatedAtMs = atMs
    writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8')

    return { deduped: true, noteId: e.noteId }
  }

  return { deduped: false }
}
