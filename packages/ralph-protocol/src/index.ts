#!/usr/bin/env node
/**
 * Ralph Protocol v2 - Global Agent Scaffold System
 * "Files are state, memory is cache"
 * 
 * A text-based operating system for LLM agents with:
 * - Command whitelisting and safety checks
 * - Robust context extraction
 * - Automatic checkpointing
 * - Human intervention brake
 */

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync, readFileSync, appendFileSync, copyFileSync, unlinkSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { execSync, spawn } from "child_process";
import { createInterface } from "readline";

const program = new Command();

// ============================================================================
// CONFIGURATION
// ============================================================================

const COMMAND_WHITELIST = [
  "git", "make", "npm", "npx", "python", "python3", "pip", "pip3",
  "ls", "cat", "echo", "grep", "touch", "mkdir", "cp", "mv",
  "node", "tsc", "jest", "pytest", "cargo", "go", "dotnet"
];

const DANGEROUS_PATTERNS = [
  /--force/i,
  /--hard/i,
  /\brm\s+-rf/i,
  /\brm\s.*\*/,
  />\s*\/dev\//,
  /\|\s*bash/,
  /\|\s*sh/,
  /eval\s/,
  /\$\(/,
  /`.*`/,
  /&&\s*rm/,
  /;\s*rm/,
  /format\s+c:/i,
  /del\s+\/[sq]/i
];

const MAX_CONFUCIUS_LINES = 200;
const COMMAND_TIMEOUT_MS = 60000;

// ============================================================================
// FILE TEMPLATES
// ============================================================================

const TEMPLATES = {
  "PRD.md": `# Project Requirements Document

## Vision
[Describe the project vision here]

## Goals
1. [Goal 1]
2. [Goal 2]
3. [Goal 3]

## Non-Goals
- [What this project will NOT do]

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
`,

  "tasks.md": `# Task Management

## Current Task
[No task assigned yet]

## Backlog
- [ ] Task 1
- [ ] Task 2

## Completed
- [x] Project initialized
`,

  "progress.txt": `# Progress Log
# Format: [TASK] -> ACTION -> RESULT

[INIT] -> Created project scaffold -> Success
`,

  "confucius.md": `# Confucius State Document
> "Files are state, memory is cache"

## North Star
[The ultimate goal of this project]

## Current State
- Project initialized
- Awaiting first task

## Decisions Made
1. Using Ralph Protocol for agent orchestration

## Open Questions
- [ ] What is the first priority?

## Learnings
- Files persist, context windows don't

## Constraints
- Must commit state to files
- Must verify before proceeding
`,

  "PROMPT.md": `# Agent Operating Instructions

You are an autonomous agent operating under the Ralph Protocol.

## Core Principles
1. **Files are state, memory is cache** - Always read files for context
2. **Think, Act, Verify, Record** - Every iteration follows this cycle
3. **Commit to disk** - Progress not written is progress lost

## Response Format
Every response MUST include:

\`\`\`
A. Current Understanding:
[What you understand about the current state]

B. Planned Action:
[What you will do next]

C. Commands:
\`command here\`

D. Verification:
[How you will verify success]

E. State Update:
[What to append to progress.txt]
\`\`\`

## Rules
1. NEVER assume file contents - always read them first
2. NEVER proceed without verifying the previous step
3. EVERY code change requires:
   - Update progress.txt (append: [TASK] -> ACTION -> RESULT)
   - Update confucius.md (REWRITE 'Current State' section)
4. If stuck for 3 iterations, STOP and ask for human help
5. NEVER use dangerous commands (rm -rf, --force, etc.)

## Available Commands
- git (add, commit, push, status, diff)
- npm/npx (install, run, build, test)
- python/pip (run scripts, install packages)
- File operations (cat, ls, mkdir, touch, cp, mv)
- make, node, tsc, jest, pytest

## Forbidden
- rm -rf
- --force flags
- Piping to bash/sh
- eval
- Format/delete drives
`
};

// ============================================================================
// SAFETY FUNCTIONS
// ============================================================================

function isCommandSafe(cmd: string): { safe: boolean; reason?: string } {
  const trimmed = cmd.trim();
  
  // Extract the base command
  const baseCmd = trimmed.split(/\s+/)[0];
  
  // Check whitelist
  if (!COMMAND_WHITELIST.some(allowed => baseCmd === allowed || baseCmd.endsWith(`/${allowed}`))) {
    return { safe: false, reason: `Command '${baseCmd}' not in whitelist` };
  }
  
  // Check dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { safe: false, reason: `Matches dangerous pattern: ${pattern}` };
    }
  }
  
  return { safe: true };
}

function executeCommand(cmd: string, cwd: string, logFile: string): { success: boolean; output: string } {
  const safety = isCommandSafe(cmd);
  
  if (!safety.safe) {
    const msg = `BLOCKED: ${cmd}\nReason: ${safety.reason}`;
    appendFileSync(logFile, `\n[BLOCKED] ${new Date().toISOString()}\n${msg}\n`);
    return { success: false, output: msg };
  }
  
  try {
    appendFileSync(logFile, `\n[EXEC] ${new Date().toISOString()}\n$ ${cmd}\n`);
    
    const output = execSync(cmd, {
      cwd,
      timeout: COMMAND_TIMEOUT_MS,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"]
    });
    
    appendFileSync(logFile, output + "\n");
    return { success: true, output };
  } catch (err: any) {
    const errorMsg = err.stderr || err.message || "Unknown error";
    appendFileSync(logFile, `[ERROR] ${errorMsg}\n`);
    return { success: false, output: errorMsg };
  }
}

// ============================================================================
// CONTEXT EXTRACTION (Robust AWK-style parsing)
// ============================================================================

function extractCurrentTask(tasksContent: string): string {
  const lines = tasksContent.split("\n");
  let inCurrentTask = false;
  
  for (const line of lines) {
    if (line.includes("## Current Task")) {
      inCurrentTask = true;
      continue;
    }
    if (inCurrentTask && line.startsWith("##")) {
      break;
    }
    if (inCurrentTask && line.trim().length > 0) {
      return line.trim();
    }
  }
  
  return "[No task assigned]";
}

function buildContext(projectDir: string): string {
  const files = ["PRD.md", "tasks.md", "progress.txt", "confucius.md", "PROMPT.md"];
  let context = "";
  
  for (const file of files) {
    const filePath = join(projectDir, file);
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf-8");
      
      if (file === "progress.txt") {
        // Only last 100 lines
        const lines = content.split("\n");
        context += `\n--- ${file} (last 100 lines) ---\n`;
        context += lines.slice(-100).join("\n");
      } else if (file === "tasks.md") {
        context += `\n--- ${file} ---\n`;
        context += content;
        context += `\n\nCurrent Task: ${extractCurrentTask(content)}`;
      } else {
        context += `\n--- ${file} ---\n`;
        context += content;
      }
      context += "\n";
    }
  }
  
  return context;
}

// ============================================================================
// CONFUCIUS TRIMMING (Structure-preserving)
// ============================================================================

function trimConfucius(projectDir: string): void {
  const confuciusPath = join(projectDir, "confucius.md");
  const archiveDir = join(projectDir, ".ralph", "archive");
  
  if (!existsSync(confuciusPath)) return;
  
  const content = readFileSync(confuciusPath, "utf-8");
  const lines = content.split("\n");
  
  if (lines.length <= MAX_CONFUCIUS_LINES) return;
  
  // Archive old version
  mkdirSync(archiveDir, { recursive: true });
  const archivePath = join(archiveDir, `confucius_${Date.now()}.md`);
  copyFileSync(confuciusPath, archivePath);
  
  // Preserve structure
  const sections: Record<string, string[]> = {};
  let currentSection = "header";
  sections[currentSection] = [];
  
  for (const line of lines) {
    if (line.startsWith("## ")) {
      currentSection = line;
      sections[currentSection] = [];
    } else {
      sections[currentSection].push(line);
    }
  }
  
  // Rebuild with trimmed content
  let newContent = "";
  
  // Keep header (first 10 lines of header section)
  newContent += sections["header"].slice(0, 10).join("\n") + "\n";
  
  // Keep important sections fully
  const importantSections = ["## North Star", "## Current State", "## Decisions Made", "## Open Questions"];
  for (const section of importantSections) {
    if (sections[section]) {
      newContent += `\n${section}\n`;
      newContent += sections[section].slice(-20).join("\n") + "\n";
    }
  }
  
  // Trim learnings to last 10
  if (sections["## Learnings"]) {
    newContent += "\n## Learnings\n";
    newContent += sections["## Learnings"].slice(-10).join("\n") + "\n";
  }
  
  writeFileSync(confuciusPath, newContent);
  console.log(`Trimmed confucius.md (archived to ${archivePath})`);
}

// ============================================================================
// PAUSE/RESUME MECHANISM
// ============================================================================

function isPaused(projectDir: string): boolean {
  return existsSync(join(projectDir, ".ralph", "PAUSE"));
}

function pause(projectDir: string): void {
  const pauseFile = join(projectDir, ".ralph", "PAUSE");
  writeFileSync(pauseFile, `Paused at ${new Date().toISOString()}\n`);
  console.log("Agent PAUSED. Remove .ralph/PAUSE to continue.");
}

function resume(projectDir: string): void {
  const pauseFile = join(projectDir, ".ralph", "PAUSE");
  if (existsSync(pauseFile)) {
    unlinkSync(pauseFile);
    console.log("Agent RESUMED.");
  }
}

// ============================================================================
// CLI COMMANDS
// ============================================================================

program
  .name("ralph")
  .description("Ralph Protocol v2 - Global Agent Scaffold System")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize Ralph Protocol in current directory")
  .option("--name <name>", "Project name")
  .option("--vision <vision>", "Project vision statement")
  .action((opts) => {
    const projectDir = process.cwd();
    const ralphDir = join(projectDir, ".ralph");
    const archiveDir = join(ralphDir, "archive");
    const logsDir = join(ralphDir, "logs");
    
    // Create directories
    mkdirSync(ralphDir, { recursive: true });
    mkdirSync(archiveDir, { recursive: true });
    mkdirSync(logsDir, { recursive: true });
    
    // Create template files
    for (const [filename, content] of Object.entries(TEMPLATES)) {
      const filePath = join(projectDir, filename);
      if (!existsSync(filePath)) {
        let fileContent = content;
        if (opts.name) {
          fileContent = fileContent.replace("[Describe the project vision here]", opts.name);
        }
        if (opts.vision) {
          fileContent = fileContent.replace("[The ultimate goal of this project]", opts.vision);
        }
        writeFileSync(filePath, fileContent);
        console.log(`Created: ${filename}`);
      } else {
        console.log(`Skipped (exists): ${filename}`);
      }
    }
    
    // Create .gitignore entries
    const gitignorePath = join(projectDir, ".gitignore");
    const gitignoreEntries = "\n# Ralph Protocol\n.ralph/logs/\n.ralph/PAUSE\n";
    if (existsSync(gitignorePath)) {
      const existing = readFileSync(gitignorePath, "utf-8");
      if (!existing.includes(".ralph/")) {
        appendFileSync(gitignorePath, gitignoreEntries);
      }
    } else {
      writeFileSync(gitignorePath, gitignoreEntries);
    }
    
    console.log("\n✓ Ralph Protocol initialized!");
    console.log("\nNext steps:");
    console.log("  1. Edit PRD.md with your project requirements");
    console.log("  2. Edit confucius.md with your North Star");
    console.log("  3. Add tasks to tasks.md");
    console.log("  4. Run: ralph context (to see agent context)");
    console.log("  5. Run: ralph run <command> (to execute safely)");
  });

program
  .command("context")
  .description("Show the current agent context")
  .action(() => {
    const projectDir = process.cwd();
    const context = buildContext(projectDir);
    console.log(context);
  });

program
  .command("task <description>")
  .description("Set the current task")
  .action((description) => {
    const projectDir = process.cwd();
    const tasksPath = join(projectDir, "tasks.md");
    
    if (!existsSync(tasksPath)) {
      console.error("No tasks.md found. Run 'ralph init' first.");
      process.exit(1);
    }
    
    let content = readFileSync(tasksPath, "utf-8");
    content = content.replace(
      /## Current Task\n.*/,
      `## Current Task\n${description}`
    );
    writeFileSync(tasksPath, content);
    
    // Log to progress
    const progressPath = join(projectDir, "progress.txt");
    appendFileSync(progressPath, `\n[TASK] -> Set current task -> ${description}`);
    
    console.log(`✓ Current task set to: ${description}`);
  });

program
  .command("run <command...>")
  .description("Execute a command with safety checks")
  .action((commandParts) => {
    const projectDir = process.cwd();
    const logsDir = join(projectDir, ".ralph", "logs");
    const logFile = join(logsDir, `run_${Date.now()}.log`);
    
    mkdirSync(logsDir, { recursive: true });
    
    const cmd = commandParts.join(" ");
    console.log(`Executing: ${cmd}`);
    
    const result = executeCommand(cmd, projectDir, logFile);
    
    if (result.success) {
      console.log(result.output);
    } else {
      console.error(`Failed: ${result.output}`);
      process.exit(1);
    }
  });

program
  .command("progress <message>")
  .description("Append to progress.txt")
  .option("--task <task>", "Task name", "MANUAL")
  .option("--action <action>", "Action taken", "Update")
  .action((message, opts) => {
    const projectDir = process.cwd();
    const progressPath = join(projectDir, "progress.txt");
    
    const entry = `\n[${opts.task}] -> ${opts.action} -> ${message}`;
    appendFileSync(progressPath, entry);
    console.log(`✓ Logged: ${entry.trim()}`);
  });

program
  .command("trim")
  .description("Trim confucius.md to prevent context overflow")
  .action(() => {
    const projectDir = process.cwd();
    trimConfucius(projectDir);
    console.log("✓ Trimmed confucius.md");
  });

program
  .command("pause")
  .description("Pause agent execution")
  .action(() => {
    pause(process.cwd());
  });

program
  .command("resume")
  .description("Resume agent execution")
  .action(() => {
    resume(process.cwd());
  });

program
  .command("status")
  .description("Show Ralph Protocol status")
  .action(() => {
    const projectDir = process.cwd();
    const ralphDir = join(projectDir, ".ralph");
    
    console.log("\n=== Ralph Protocol Status ===\n");
    
    // Check initialization
    if (!existsSync(ralphDir)) {
      console.log("❌ Not initialized (run 'ralph init')");
      return;
    }
    console.log("✓ Initialized");
    
    // Check required files
    const requiredFiles = ["PRD.md", "tasks.md", "progress.txt", "confucius.md", "PROMPT.md"];
    for (const file of requiredFiles) {
      const exists = existsSync(join(projectDir, file));
      console.log(`${exists ? "✓" : "❌"} ${file}`);
    }
    
    // Check pause status
    if (isPaused(projectDir)) {
      console.log("\n⏸️  PAUSED (run 'ralph resume' to continue)");
    } else {
      console.log("\n▶️  ACTIVE");
    }
    
    // Show current task
    const tasksPath = join(projectDir, "tasks.md");
    if (existsSync(tasksPath)) {
      const tasksContent = readFileSync(tasksPath, "utf-8");
      console.log(`\nCurrent Task: ${extractCurrentTask(tasksContent)}`);
    }
    
    // Show confucius size
    const confuciusPath = join(projectDir, "confucius.md");
    if (existsSync(confuciusPath)) {
      const lines = readFileSync(confuciusPath, "utf-8").split("\n").length;
      console.log(`\nConfucius.md: ${lines}/${MAX_CONFUCIUS_LINES} lines`);
      if (lines > MAX_CONFUCIUS_LINES * 0.8) {
        console.log("⚠️  Consider running 'ralph trim'");
      }
    }
  });

program
  .command("archive")
  .description("List archived confucius.md files")
  .action(() => {
    const archiveDir = join(process.cwd(), ".ralph", "archive");
    
    if (!existsSync(archiveDir)) {
      console.log("No archives found.");
      return;
    }
    
    const files = readdirSync(archiveDir).filter(f => f.startsWith("confucius_"));
    if (files.length === 0) {
      console.log("No archives found.");
      return;
    }
    
    console.log("\n=== Confucius Archives ===\n");
    for (const file of files.sort().reverse()) {
      const timestamp = file.replace("confucius_", "").replace(".md", "");
      const date = new Date(parseInt(timestamp));
      console.log(`  ${file} (${date.toLocaleString()})`);
    }
  });

program
  .command("validate <command>")
  .description("Check if a command is safe to execute")
  .action((command) => {
    const result = isCommandSafe(command);
    if (result.safe) {
      console.log(`✓ SAFE: ${command}`);
    } else {
      console.log(`✗ BLOCKED: ${command}`);
      console.log(`  Reason: ${result.reason}`);
    }
  });

program.parse();
