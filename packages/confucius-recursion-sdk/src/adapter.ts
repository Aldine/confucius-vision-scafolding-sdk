/**
 * Confucius Adapter Interface
 * 
 * Defines how Confucius integrates with agentic IDE runtimes.
 * The adapter provides host capabilities (model calls, subagent spawning, tools).
 */

export interface ConfuciusAdapter {
  /**
   * Get runtime information for detection and strict mode logic
   */
  getRuntimeInfo(): RuntimeInfo;
  
  /**
   * Call the base model (for plans, analysis, single-step tasks)
   */
  runModel(prompt: string, input: any): Promise<string | object>;
  
  /**
   * Spawn a subagent (optional - only available in true agentic runtimes)
   */
  runSubagent?(args: SubagentRequest): Promise<string>;
  
  /**
   * Get available tools (optional - for capability detection)
   */
  getTools?(): Promise<string[]>;
}

export interface RuntimeInfo {
  host: 'copilot' | 'claude' | 'standalone';
  strictMode: boolean;
  capabilities: string[];  // ['runSubagent', 'runModel', 'getTools']
  version?: string;
}

export interface SubagentRequest {
  description: string;
  prompt: string;
}

/**
 * Default adapter for VS Code Copilot
 * Detects runtime capabilities from globalThis and environment
 */
export class CopilotAdapter implements ConfuciusAdapter {
  getRuntimeInfo(): RuntimeInfo {
    // Detect Copilot agentic runtime with TWO signals
    const signals = [
      process.env.COPILOT_AGENTIC === 'true',
      process.env.VSCODE_PID !== undefined,
      process.env.TERM_PROGRAM === 'vscode',
      typeof (globalThis as any).runSubagent !== 'undefined'
    ].filter(Boolean).length;
    
    const autoStrict = signals >= 2;
    
    const capabilities: string[] = ['runModel'];
    if (typeof (globalThis as any).runSubagent !== 'undefined') {
      capabilities.push('runSubagent');
    }
    
    return {
      host: 'copilot',
      strictMode: autoStrict,
      capabilities,
      version: process.env.COPILOT_VERSION
    };
  }
  
  async runModel(_prompt: string, _input: any): Promise<string | object> {
    // In real Copilot, this would call the underlying model
    // For now, this is a placeholder - actual implementation
    // would integrate with Copilot's model API
    throw new Error('runModel not implemented - use runSubagent in Copilot');
  }
  
  async runSubagent(args: SubagentRequest): Promise<string> {
    if (typeof (globalThis as any).runSubagent === 'undefined') {
      throw new Error('runSubagent not available in this runtime');
    }
    
    return await (globalThis as any).runSubagent({
      description: args.description,
      prompt: args.prompt
    });
  }
  
  async getTools(): Promise<string[]> {
    // Would introspect available Copilot tools
    return ['runSubagent', 'read_file', 'write_file'];
  }
}

/**
 * Standalone adapter for simulation and testing
 */
export class StandaloneAdapter implements ConfuciusAdapter {
  getRuntimeInfo(): RuntimeInfo {
    return {
      host: 'standalone',
      strictMode: false,  // Never auto-strict in standalone
      capabilities: ['runModel'],
      version: 'standalone'
    };
  }
  
  async runModel(prompt: string, _input: any): Promise<string | object> {
    // Simulation returns mock data
    return { simulated: true, prompt: prompt.substring(0, 100) };
  }
  
  // No runSubagent in standalone
}

/**
 * Create appropriate adapter based on environment detection
 */
export function createAdapter(): ConfuciusAdapter {
  // Detect if we're in Copilot
  if (process.env.VSCODE_PID || process.env.COPILOT_AGENTIC === 'true') {
    return new CopilotAdapter();
  }
  
  // Default to standalone
  return new StandaloneAdapter();
}






