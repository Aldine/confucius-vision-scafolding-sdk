/**
 * @aldine/confucius-agent - Public API surface
 * 
 * This package provides a clean product interface to the Confucius
 * recursion engine. Re-exports core functionality from the engine.
 */

export {
  runWithConfucius,
  type ConfuciusConfig,
  type ConfuciusResult,
  type SpawnAdapter,
  type SpawnResult
} from '@aldine/confucius-recursion-sdk';
