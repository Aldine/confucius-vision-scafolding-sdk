import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export type ConfuciusRepoConfig = {
  schemaVersion?: string
  defaultMode?: 'agentic' | 'local'
  strictMode?: boolean
  useWorker?: boolean
  proofMaxAgeMin?: number
  notes?: { enabled?: boolean; dir?: string }
}

export type ResolvedConfuciusConfig = {
  contractMode: 'agentic' | 'local'
  strictMode: boolean
  useWorker: boolean
  proofMaxAgeMin: number
  notesEnabled: boolean
  notesDir: string
  source: {
    configPath: string
    loaded: boolean
  }
}

function parseBoolEnv(name: string): boolean | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const s = v.trim().toLowerCase()
  if (s === '1' || s === 'true' || s === 'yes' || s === 'on') return true
  if (s === '0' || s === 'false' || s === 'no' || s === 'off') return false
  return undefined
}

function parseIntEnv(name: string): number | undefined {
  const v = process.env[name]
  if (!v) return undefined
  const n = Number.parseInt(v, 10)
  return Number.isFinite(n) ? n : undefined
}

function findRepoRoot(startDir: string): string {
  // Walk up until we find a package.json or a .git folder.
  // Windows + ESM safe.
  let dir = startDir
  for (let i = 0; i < 20; i++) {
    const pkg = resolve(dir, 'package.json')
    const git = resolve(dir, '.git')
    if (existsSync(pkg) || existsSync(git)) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return startDir
}

function safeReadJson(path: string): ConfuciusRepoConfig | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf8')
    const obj = JSON.parse(raw)
    if (!obj || typeof obj !== 'object') return null
    return obj as ConfuciusRepoConfig
  } catch {
    return null
  }
}

export function loadResolvedConfuciusConfig(): ResolvedConfuciusConfig {
  // Derive a stable "here" dir in ESM
  const here = resolve(fileURLToPath(import.meta.url), '..', '..')
  const repoRoot = findRepoRoot(here)

  const configPath = resolve(repoRoot, '.confucius', 'config.json')
  const fileCfg = safeReadJson(configPath)

  const cfgDefaultMode = fileCfg?.defaultMode
  const cfgStrict = fileCfg?.strictMode
  const cfgWorker = fileCfg?.useWorker
  const cfgMaxAge = fileCfg?.proofMaxAgeMin
  const cfgNotesEnabled = fileCfg?.notes?.enabled
  const cfgNotesDir = fileCfg?.notes?.dir

  // Env overrides (optional)
  const envStrict = parseBoolEnv('CONFUCIUS_STRICT_MODE')
  const envWorker = parseBoolEnv('CONFUCIUS_USE_WORKER')
  const envMode = process.env.CONFUCIUS_MODE === 'agentic' || process.env.CONFUCIUS_MODE === 'local'
    ? (process.env.CONFUCIUS_MODE as 'agentic' | 'local')
    : undefined
  const envMaxAge = parseIntEnv('CONFUCIUS_PROOF_MAX_AGE_MIN')

  // Final defaults
  const contractMode =
    envMode ??
    cfgDefaultMode ??
    (envStrict === true ? 'agentic' : 'local')

  const strictMode =
    envStrict ??
    cfgStrict ??
    (contractMode === 'agentic')

  const useWorker =
    envWorker ??
    cfgWorker ??
    true

  const proofMaxAgeMin =
    envMaxAge ??
    cfgMaxAge ??
    10

  const notesEnabled =
    cfgNotesEnabled ?? true

  const notesDir =
    cfgNotesDir ??
    '.confucius/notes'

  return {
    contractMode,
    strictMode,
    useWorker,
    proofMaxAgeMin,
    notesEnabled,
    notesDir,
    source: { configPath, loaded: Boolean(fileCfg) }
  }
}
