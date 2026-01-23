/**
 * Quality Gates with Retry Logic
 * 
 * Prevents token rot by validating subagent outputs:
 * - Required keys present
 * - Minimum numeric metrics
 * - No placeholder/handwave language
 * - Retry failed outputs with stricter prompts
 */

export interface QualityGateResult {
  ok: boolean;
  errors: string[];
  numericCount: number;
}

export interface RetryResult {
  ok: boolean;
  attempts: number;
  result?: any;
  gate?: QualityGateResult;
  lastResult?: any;
  reason?: string;
}

/**
 * Count numeric values in nested object
 */
function countNumericValues(obj: any): number {
  let n = 0;
  const walk = (v: any): void => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      n += 1;
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) walk(v[k]);
    }
  };
  walk(obj);
  return n;
}

/**
 * Detect placeholder and handwave phrases that indicate low-quality output
 */
function containsBadPhrases(text: string): string | null {
  const t = String(text || '').toLowerCase();
  const bad = [
    'i guess',
    'seems like',
    'looks like',
    'probably',
    'maybe',
    'not sure',
    'cannot access',
    'no access',
    'i did not',
    "i didn't",
    'placeholder',
    'todo',
    'tbd',
    'coming soon',
    'not implemented'
  ];
  
  for (const b of bad) {
    if (t.includes(b)) return b;
  }
  
  return null;
}

/**
 * Quality gate validation
 * 
 * @param output - Subagent output to validate
 * @param requiredKeys - Keys that must exist in output
 * @param minNumericCount - Minimum number of numeric values required
 */
export function qualityGate({
  output,
  requiredKeys = [],
  minNumericCount = 0
}: {
  output: any;
  requiredKeys?: string[];
  minNumericCount?: number;
}): QualityGateResult {
  const errors: string[] = [];

  // Check output is an object
  if (!output || typeof output !== 'object') {
    return { ok: false, errors: ['output_not_object'], numericCount: 0 };
  }


  // Check required keys present
  if (requiredKeys && requiredKeys.length) {
    for (const k of requiredKeys) {
      if (!(k in output)) {
        errors.push(`missing_key:${k}`);
      }
    }
  }

  // Check numeric value count
  const numericCount = countNumericValues(output);
  if (numericCount < minNumericCount) {
    errors.push(`too_few_numeric_values:${numericCount}<${minNumericCount}`);
  }

  // Check for handwave language
  const badPhrase = containsBadPhrases(JSON.stringify(output));
  if (badPhrase) {
    errors.push(`handwave_phrase:${badPhrase}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    numericCount
  };
}

/**
 * Run subagent execution with retry on quality gate failure
 * 
 * @param attemptFn - async function that executes subagent
 * @param maxAttempts - maximum retry attempts
 * @param gateFn - function that validates output
 * @param tightenPromptFn - optional function to modify prompt between retries
 */
export async function runWithRetry({
  attemptFn,
  maxAttempts,
  gateFn,
  tightenPromptFn
}: {
  attemptFn: (ctx: { attempt: number }) => Promise<any>;
  maxAttempts: number;
  gateFn: (output: any) => QualityGateResult;
  tightenPromptFn?: ((ctx: { attempt: number; gateErrors: string[] }) => void) | null;
}): Promise<RetryResult> {
  let last: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const res = await attemptFn({ attempt });
    last = res;

    const gate = gateFn(res);
    
    if (gate.ok) {
      return {
        ok: true,
        attempts: attempt,
        result: res,
        gate
      };
    }

    // Log quality gate failure
    console.log(`[Quality Gate] Attempt ${attempt} failed: ${gate.errors.join(', ')}`);

    // Tighten prompt for next attempt
    if (attempt < maxAttempts) {
      if (tightenPromptFn) {
        tightenPromptFn({ attempt, gateErrors: gate.errors });
      }
    }
  }

  return {
    ok: false,
    attempts: maxAttempts,
    lastResult: last,
    reason: 'quality_gate_failed_all_attempts'
  };
}



