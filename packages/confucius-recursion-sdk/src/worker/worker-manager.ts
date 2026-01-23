import { Worker } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { MainToWorkerMessage, WorkerToMainMessage } from './protocol.js'
import type { ConfuciusAdapter } from '../adapter.js'

export type WorkerOrchestratorConfig = {
  adapter: ConfuciusAdapter
  strictMode: boolean
  maxDepth?: number
  maxSpawns?: number
  forceSleep?: boolean
  verbose?: boolean
}

export type WorkerOrchestratorResult = {
  ok: boolean
  result?: unknown
  reason?: string
  error?: string
}

/**
 * Robustly locate worker file - searches multiple locations
 * 
 * This prevents future bundler changes from silently breaking worker mode.
 * 
 * @param verbose Whether to log search attempts
 * @returns Worker file path
 * @throws Error if worker file not found in any location
 */
function getWorkerPath(verbose: boolean): string {
  const here = dirname(fileURLToPath(import.meta.url))
  
  // Try primary location: dist/worker/
  const primaryPath = resolve(here, 'worker', 'orchestrator.worker.js')
  
  if (existsSync(primaryPath)) {
    if (verbose) {
      console.log(JSON.stringify({ 
        where: 'worker-manager.getWorkerPath', 
        found: 'primary',
        path: primaryPath 
      }))
    }
    return primaryPath
  }
  
  // Fallback: dist/ (if build config flattens structure)
  const fallbackPath = resolve(here, 'orchestrator.worker.js')
  
  if (existsSync(fallbackPath)) {
    if (verbose) {
      console.log(JSON.stringify({ 
        where: 'worker-manager.getWorkerPath', 
        found: 'fallback',
        path: fallbackPath 
      }))
    }
    return fallbackPath
  }
  
  // Neither location found - fail with clear error
  throw new Error(
    `Worker file not found. Searched:\n` +
    `  1. ${primaryPath}\n` +
    `  2. ${fallbackPath}\n` +
    `Build may have failed or worker file was tree-shaken. ` +
    `Verify "dist/worker/orchestrator.worker.js" exists after build.`
  )
}

export function runWithWorker(
  task: string,
  config: WorkerOrchestratorConfig
): Promise<WorkerOrchestratorResult> {
  const { adapter, strictMode, maxDepth = 4, maxSpawns = 10, forceSleep = false, verbose = false } = config

  return new Promise((resolvePromise) => {
    const workerPath = getWorkerPath(verbose)
    const worker = new Worker(workerPath, { argv: [], env: process.env })

    const cleanup = () => {
      worker.removeAllListeners()
    }

    worker.on('error', (err) => {
      cleanup()
      resolvePromise({ ok: false, reason: 'worker_error', error: err.message })
    })

    worker.on('exit', (code) => {
      if (code !== 0 && verbose) {
        // eslint-disable-next-line no-console
        console.log(JSON.stringify({ where: 'worker-manager.exit', code }))
      }
    })

    worker.on('message', async (msg: WorkerToMainMessage) => {
      try {
        if (msg.type === 'requestSpawn') {
          if (verbose) {
            // eslint-disable-next-line no-console
            console.log(JSON.stringify({
              where: 'worker-manager.requestSpawn',
              hasRunSubagent: !!adapter.runSubagent,
              adapterType: adapter.constructor.name,
              capabilities: adapter.getRuntimeInfo().capabilities
            }))
          }

          // Gate: If no runSubagent, fail the worker immediately
          if (typeof adapter.runSubagent !== 'function') {
            const failMsg: WorkerToMainMessage = {
              type: 'fail',
              reason: 'tool_missing',
              error: 'runSubagent unavailable in worker mode'
            }
            worker.postMessage(failMsg)
            cleanup()
            resolvePromise({ ok: false, reason: 'tool_missing', error: 'runSubagent unavailable' })
            worker.terminate().catch(() => {})
            return
          }

          const result = await adapter.runSubagent({
            description: msg.agentName,
            prompt: msg.prompt
          })
          
          let output: any
          try {
            output = JSON.parse(result)
          } catch (err) {
            output = { raw: result, parseError: err instanceof Error ? err.message : String(err) }
          }
          const runId = `${msg.agentName}_${Date.now()}`

          const reply: MainToWorkerMessage = {
            type: 'modelResult',
            id: msg.id,
            result: { runId, output }
          }
          worker.postMessage(reply)
          return
        }

        if (msg.type === 'done') {
          cleanup()
          resolvePromise({ ok: true, result: msg.result })
          worker.terminate().catch(() => {})
          return
        }

        if (msg.type === 'fail') {
          cleanup()
          resolvePromise({ ok: false, reason: msg.reason, error: msg.error })
          worker.terminate().catch(() => {})
          return
        }

        // progress and any other messages
        if (verbose && msg.type === 'progress') {
          // eslint-disable-next-line no-console
          console.log(JSON.stringify({ where: 'worker-manager.progress', message: msg.message }))
        }
      } catch (err) {
        cleanup()
        const errMsg = err instanceof Error ? err.message : String(err)
        resolvePromise({ ok: false, reason: 'message_handler_error', error: errMsg })
        worker.terminate().catch(() => {})
      }
    })

    const start: MainToWorkerMessage = {
      type: 'runTask',
      task,
      strictMode,
      maxDepth,
      maxSpawns,
      forceSleep,
      verbose
    }

    worker.postMessage(start)
  })
}
