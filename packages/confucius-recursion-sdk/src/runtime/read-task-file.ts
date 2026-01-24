import { readFileSync, existsSync, unlinkSync, renameSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function findRepoRoot(start: string): string {
  let dir = start
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, '.git')) || existsSync(resolve(dir, 'package.json'))) return dir
    const parent = resolve(dir, '..')
    if (parent === dir) break
    dir = parent
  }
  return start
}

export function readTaskFromFile(): {
  task: string | undefined
  path: string
} {
  const here = resolve(fileURLToPath(import.meta.url), '..', '..')
  const root = findRepoRoot(here)

  const taskPath = resolve(root, '.confucius', 'task.txt')

  if (!existsSync(taskPath)) {
    return { task: undefined, path: taskPath }
  }

  const raw = readFileSync(taskPath, 'utf8').trim()

  return {
    task: raw.length ? raw : undefined,
    path: taskPath
  }
}

export function clearTaskFile(path: string) {
  try {
    unlinkSync(path)
  } catch {
    // ignore
  }
}

export function archiveTaskFile(path: string) {
  try {
    if (!existsSync(path)) return

    const here = resolve(fileURLToPath(import.meta.url), '..', '..')
    const root = findRepoRoot(here)
    const historyDir = resolve(root, '.confucius', 'history')

    mkdirSync(historyDir, { recursive: true })

    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15)
    const archivePath = resolve(historyDir, `task_${timestamp}.txt`)

    renameSync(path, archivePath)
  } catch {
    // fallback to delete
    clearTaskFile(path)
  }
}
