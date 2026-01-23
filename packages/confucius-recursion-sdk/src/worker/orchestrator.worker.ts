import { parentPort } from 'worker_threads';
import { randomBytes } from 'crypto';
import {
  RecursionProofOrchestratorHardened,
  type SpawnAdapter,
  type SpawnResult
} from '../orchestrator/hardened-orchestrator.js';
import type {
  MainToWorkerMessage,
  WorkerToMainMessage
} from './protocol.js';

if (!parentPort) {
  throw new Error('orchestrator.worker.ts must be run as a Worker');
}

type PendingRequest = {
  resolve: (value: SpawnResult) => void;
  reject: (error: Error) => void;
};

const pendingRequests = new Map<string, PendingRequest>();

function mintRequestId(): string {
  return randomBytes(8).toString('hex');
}

const createWorkerSpawnAdapter = (): SpawnAdapter => {
  return async (args): Promise<SpawnResult> => {
    const id = mintRequestId();

    const message: WorkerToMainMessage = {
      type: 'requestSpawn',
      id,
      agentName: args.agentName,
      prompt: args.prompt,
      input: args.input
    };

    console.log(`[WORKER LOG 1] requestSpawn id=${id} name=${args.agentName} depth=${typeof args.input === 'object' && args.input !== null && 'depth' in args.input ? (args.input as any).depth : 'unknown'}`);
    parentPort!.postMessage(message);
    
    return new Promise<SpawnResult>((resolve, reject) => {
      pendingRequests.set(id, { resolve, reject });
    });
  };
};

parentPort.on('message', async (msg: MainToWorkerMessage) => {
  try {
    if (msg.type === 'runTask') {
      const progressMsg: WorkerToMainMessage = {
        type: 'progress',
        message: 'Worker: Starting orchestration...'
      };
      parentPort!.postMessage(progressMsg);

      const adapter = createWorkerSpawnAdapter();

      if (typeof adapter !== 'function') {
        const failMsg: WorkerToMainMessage = {
          type: 'fail',
          reason: 'worker_spawnAdapter_missing',
          error: 'createWorkerSpawnAdapter did not return a function'
        };
        parentPort!.postMessage(failMsg);
        return;
      }

      const orch = new RecursionProofOrchestratorHardened({
        maxDepth: msg.maxDepth ?? 4,
        maxSpawns: msg.maxSpawns ?? 10,
        strictMode: msg.strictMode,
        forceSleep: msg.forceSleep,
        simulateWhenNoAdapter: false,
        spawnAdapter: adapter,
        verbose: true
      });

      const result = await orch.runDepth3Proof();

      const doneMsg: WorkerToMainMessage = {
        type: 'done',
        result
      };
      parentPort!.postMessage(doneMsg);

    } else if (msg.type === 'modelResult') {
      console.log(`[WORKER LOG 2] modelResult id=${msg.id} has_runId=${!!msg.result?.runId} has_output=${typeof msg.result?.output !== 'undefined'} output_type=${typeof msg.result?.output}`);
      const handler = pendingRequests.get(msg.id);
      if (handler) {
        pendingRequests.delete(msg.id);
        if (msg.error) {
          handler.reject(new Error(msg.error));
        } else {
          handler.resolve(msg.result);
        }
      }
    }
  } catch (error) {
    const failMsg: WorkerToMainMessage = {
      type: 'fail',
      reason: 'worker_error',
      error: error instanceof Error ? error.message : String(error)
    };
    parentPort!.postMessage(failMsg);
  }
});

const readyMsg: WorkerToMainMessage = {
  type: 'progress',
  message: 'Worker: Ready'
};
parentPort!.postMessage(readyMsg);
