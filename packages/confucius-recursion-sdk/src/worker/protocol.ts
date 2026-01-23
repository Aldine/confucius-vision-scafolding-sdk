/**
 * Message Protocol for Worker-Main Communication
 * 
 * Worker owns: orchestration, recursion, gates, trace, hashing
 * Main owns: tool execution (runSubagent, runModel)
 */

// ============================================
// Main → Worker Messages
// ============================================

export interface RunTaskMessage {
  type: 'runTask';
  task: string;
  strictMode: boolean;
  forceSleep?: boolean;
  maxDepth?: number;
  maxSpawns?: number;
  verbose?: boolean;
}

export interface ModelResultMessage {
  type: 'modelResult';
  id: string;
  result: {
    runId: string;
    output: unknown;
  };
  error?: string;
}

export type MainToWorkerMessage = RunTaskMessage | ModelResultMessage;

// ============================================
// Worker → Main Messages
// ============================================

export interface RequestSpawnMessage {
  type: 'requestSpawn';
  id: string;
  agentName: string;
  prompt: string;
  input: any;
}

export interface RequestModelMessage {
  type: 'requestModel';
  id: string;
  prompt: string;
  input: any;
}

export interface DoneMessage {
  type: 'done';
  result: any;
}

export interface FailMessage {
  type: 'fail';
  reason: string;
  error?: string;
}

export interface TraceEventMessage {
  type: 'traceEvent';
  event: any;
}

export interface ProgressMessage {
  type: 'progress';
  message: string;
  depth?: number;
}

export type WorkerToMainMessage =
  | RequestSpawnMessage
  | RequestModelMessage
  | DoneMessage
  | FailMessage
  | TraceEventMessage
  | ProgressMessage;
