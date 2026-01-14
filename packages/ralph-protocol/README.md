# @aldine/ralph-protocol

> "Files are state, memory is cache"

**Ralph Protocol v2** - A text-based operating system for LLM agents. This is a global CLI tool that provides a hardened scaffold for autonomous agent development.

## 🚀 Quick Start

### Global Installation

```bash
npm install -g @aldine/ralph-protocol
```

### Initialize a Project

```bash
cd your-project
ralph init --name "My AI Project" --vision "Build something amazing"
```

This creates:
```
your-project/
├── PRD.md           # Project Requirements Document
├── tasks.md         # Task management (Current Task, Backlog, Completed)
├── progress.txt     # Append-only progress log
├── confucius.md     # Agent state document (decisions, learnings, questions)
├── PROMPT.md        # Agent operating instructions
└── .ralph/
    ├── archive/     # Archived confucius.md files
    └── logs/        # Command execution logs
```

## 📖 Commands

### Core Commands

```bash
ralph init                    # Initialize Ralph Protocol in current directory
ralph status                  # Show protocol status and current task
ralph context                 # Display full agent context (for debugging)
ralph task "Build API"        # Set the current task
ralph progress "Fixed bug"    # Append to progress.txt
```

### Safety Commands

```bash
ralph run git status          # Execute command with safety checks
ralph validate "rm -rf /"     # Check if a command is safe (without running)
ralph pause                   # Pause agent execution
ralph resume                  # Resume agent execution
```

### Maintenance Commands

```bash
ralph trim                    # Trim confucius.md to prevent overflow
ralph archive                 # List archived confucius.md files
```

## 🛡️ Security Features

### Command Whitelist

Only these command prefixes are allowed:
- `git`, `make`, `npm`, `npx`
- `python`, `python3`, `pip`, `pip3`
- `ls`, `cat`, `echo`, `grep`, `touch`, `mkdir`, `cp`, `mv`
- `node`, `tsc`, `jest`, `pytest`, `cargo`, `go`, `dotnet`

### Blocked Patterns

These patterns are automatically blocked:
- `rm -rf` (recursive force delete)
- `--force` / `--hard` flags
- Pipe to bash/sh (`| bash`)
- `eval` commands
- Backtick execution
- Redirect to /dev/

### Timeout Protection

All commands have a 60-second timeout to prevent hanging processes.

## 📋 File Formats

### tasks.md

```markdown
# Task Management

## Current Task
Build the user authentication API

## Backlog
- [ ] Add rate limiting
- [ ] Write tests

## Completed
- [x] Set up project structure
```

### progress.txt

```
# Progress Log
# Format: [TASK] -> ACTION -> RESULT

[AUTH] -> Created user model -> Success
[AUTH] -> Added JWT validation -> Success
[API] -> Implemented /login endpoint -> Success
```

### confucius.md

```markdown
# Confucius State Document

## North Star
Build a secure, scalable authentication system

## Current State
- User model complete
- JWT validation working
- Need to implement refresh tokens

## Decisions Made
1. Using JWT for stateless auth
2. Refresh tokens stored in Redis

## Open Questions
- [ ] Token expiration time?
- [ ] Rate limit thresholds?

## Learnings
- JWT secret must be rotated
- Redis connection pooling important
```

## 🔄 Agent Integration

### With VS Code Copilot

Add to your `.vscode/mcp.json`:

```json
{
  "servers": {
    "ralph": {
      "type": "stdio",
      "command": "ralph",
      "args": ["context"]
    }
  }
}
```

### With Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "ralph": {
      "command": "ralph",
      "args": ["context"]
    }
  }
}
```

### Prompt Template for Agents

Include this in your system prompt:

```
You are operating under the Ralph Protocol.

Before ANY action:
1. Run: ralph context (to get current state)
2. Read the Current Task from tasks.md

After EVERY action:
1. Run: ralph progress "What you did" --task TASKNAME
2. Update confucius.md if you learned something new

Response format:
A. Current Understanding: [what you know]
B. Planned Action: [what you'll do]
C. Commands: `ralph run <command>`
D. Verification: [how to verify]
E. State Update: [what to log]
```

## 🔧 Programmatic Usage

```typescript
import { execSync } from 'child_process';

// Get agent context
const context = execSync('ralph context', { encoding: 'utf-8' });

// Set task
execSync('ralph task "Build feature X"');

// Execute safely
execSync('ralph run npm test');

// Log progress
execSync('ralph progress "Tests passing" --task FEATURE');
```

## 📊 Status Dashboard

```bash
$ ralph status

=== Ralph Protocol Status ===

✓ Initialized
✓ PRD.md
✓ tasks.md
✓ progress.txt
✓ confucius.md
✓ PROMPT.md

▶️  ACTIVE

Current Task: Build user authentication API

Confucius.md: 45/200 lines
```

## 🧠 Philosophy

The Ralph Protocol is built on these principles:

1. **Files are state** - The filesystem is the single source of truth
2. **Memory is cache** - LLM context windows are temporary; persist everything
3. **Think, Act, Verify, Record** - Every iteration follows this cycle
4. **Safety by default** - Commands are whitelisted, not blacklisted
5. **Human-in-the-loop** - The pause mechanism allows intervention

## 🔗 Related

- [@aldine/confucius-mcp-browser](https://www.npmjs.com/package/@aldine/confucius-mcp-browser) - Browser automation SDK
- [Confucius Vision Scaffolding SDK](https://github.com/Aldine/confucius-vision-scafolding-sdk) - Full SDK repository

## 📄 License

MIT
