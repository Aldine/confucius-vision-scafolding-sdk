# @aldine/ralph-protocol

> "Files are state, memory is cache"

**Ralph Protocol v3** - A text-based operating system for LLM agents with **3-Strike Reset** and **Token Rot Prevention**. A global CLI tool that provides a hardened scaffold for autonomous agent development.

## ✨ What's New in v3

- **3-Strike Failure Policy**: Auto-reset after 3 failed attempts
- **Token Rot Prevention**: Hard cap on confucius.md, automatic archiving
- **Loop Scripts**: Bash/PowerShell scripts for continuous agent execution
- **Subagent Spawning**: Fresh context generation for hard resets
- **IDEA.md**: New file for Problem/User/Outcome
- **Commit Verification**: Enforces state file updates on every commit

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
├── IDEA.md          # Problem, User, Outcome (one paragraph each)
├── PRD.md           # Scope, Non-goals, User Stories, Metrics, Constraints
├── tasks.md         # Current Task, Backlog, In Progress, Completed
├── progress.txt     # Append-only: DATETIME | TASK | ACTION | RESULT | NEXT
├── confucius.md     # State document (<200 lines)
├── PROMPT.md        # Agent operating instructions
└── .ralph/
    ├── archive/     # Archived confucius.md and logs
    ├── logs/        # Command execution logs
    └── strikes.json # Strike counter state
```

## 📖 Commands

### Core Commands

```bash
ralph init                    # Initialize Ralph Protocol
ralph status                  # Show status, strikes, token health
ralph context                 # Display full agent context
ralph task "Build API"        # Set the current task
ralph progress "Fixed bug"    # Append to progress.txt
ralph idea --problem "..."    # Edit IDEA.md
```

### 🔴 Strike System (NEW)

```bash
ralph strike "Agent looping"  # Record a strike (max 3)
ralph unstrike                # Clear all strikes on success
ralph reset --error "..."     # Hard reset: new run ID, fresh context
ralph history                 # View strike history
ralph check "agent output"    # Check output for failure patterns
```

**3-Strike Rule:**
- Strike 1: Ask for single smallest change
- Strike 2: Force diagnosis (reproduce → isolate → test)
- Strike 3: **Hard reset** - spawn fresh subagent

### 🔄 Loop Execution (NEW)

```bash
ralph loop --powershell       # Generate PowerShell loop script
ralph loop --bash             # Generate Bash loop script
ralph loop --agent "claude"   # Specify agent CLI command
```

The loop script:
1. Feeds context to agent
2. Detects failure patterns in output
3. Records strikes automatically
4. Auto-resets after 3 strikes
5. Supports pause/resume

### 🧠 Subagent Spawning (NEW)

```bash
ralph subagent                # Generate minimal context for fresh agent
ralph subagent --error "..."  # Include the failing error
ralph subagent --output ctx.md # Write to file
```

**What gets passed to subagent:**
- PRD.md (full)
- confucius.md (full)
- Failing error (if provided)
- Touched file tree (git status)

**What does NOT get passed:**
- Chat history
- Old logs
- Progress history

### Safety Commands

```bash
ralph run git status          # Execute command with safety checks
ralph validate "rm -rf /"     # Check if safe (without running)
ralph pause                   # Pause agent execution
ralph resume                  # Resume agent execution
ralph commit -m "message"     # Commit with state file verification
```

### Token Rot Prevention

```bash
ralph trim                    # Trim confucius.md (archives old)
ralph archive                 # List archived files
```

## 🛡️ Security Features

### Command Whitelist (Expanded)

```
git, make, npm, npx, pnpm, yarn, bun
python, python3, pip, pip3, uv, poetry
ls, cat, echo, grep, head, tail, touch, mkdir, cp, mv, pwd
node, tsc, jest, vitest, pytest, cargo, go, dotnet, java, mvn, gradle
docker, kubectl, terraform, az, aws, gcloud
curl, wget, jq, yq, sed, awk, find, xargs, sort, uniq, wc
code, claude, copilot
```

### Blocked Patterns

- `rm -rf`, `--force`, `--hard`
- Pipe to bash/sh (`| bash`, `| sh`)
- `eval`, `$()`, backticks
- `chmod 777`, `drop database`, `truncate table`
- Redirect to /etc/ or /dev/
- `curl | sudo`

### Failure Detection Patterns

```
I cannot, unable to, need more context
looping, repeating, stuck, same error
I don't have access, missing information
cannot proceed
```

## 📋 File Formats

### IDEA.md (NEW)

```markdown
# Project Idea

## Problem
Users waste hours debugging because error messages are cryptic.

## User
Developers working on complex codebases.

## Outcome
Clear, actionable error messages that reduce debug time by 50%.
```

### progress.txt (Enhanced Format)

```
# Format: DATETIME | TASK | ACTION | RESULT | NEXT | FILES/COMMITS

2024-01-15T10:30:00Z | AUTH | Added JWT validation | Success | Add refresh tokens | src/auth.ts
2024-01-15T11:00:00Z | STRIKE | Agent looping | Strike 1/3 | Retry | .ralph/strikes.json
2024-01-15T11:15:00Z | RESET | Hard reset triggered | run_id=2 | Fresh context | .ralph/strikes.json
```

### confucius.md (Under 200 lines)

```markdown
# Confucius State Document
> Target: Under 200 lines

## North Star
Reduce debugging time by 50% with clear error messages.

## Current State
- What works: JWT validation passes all tests
- What fails: Refresh token flow not implemented
- What you learned: Token expiry needs 15-min buffer

## Current Task
Implement refresh token endpoint

## Constraints
- Stack: Node.js, Express, PostgreSQL
- APIs: Auth0 for SSO
- Environment: Node 20+

## Decisions
1. Using RS256 for JWT signing (security requirement)
2. 15-min access token expiry with 7-day refresh

## Open Questions
- [ ] Should refresh tokens be single-use?

## Next Steps
1. Create /auth/refresh endpoint
2. Add refresh_token table
3. Write integration tests
```

### PROMPT.md (Agent Instructions)

```markdown
You are Ralph, a build loop agent.

## Rules
1. Read PRD.md, progress.txt, confucius.md, tasks.md before doing work.
2. Do the next smallest step toward the current task.
3. If you change code, you must also update progress.txt and confucius.md.
4. You must give a run command and a verification step.
5. You must stop and ask for missing inputs if you cannot run or verify.

## Output Format
A. Plan: 3 steps max
B. Changes: list files changed
C. Commands: exact commands to run
D. Verification: what output proves success
E. Updates: append-ready text for progress.txt and confucius.md

## Failure Definition
- Output does not compile or run
- Repeating without new evidence
- Ignoring constraints in PRD.md
- Changes without updating progress.txt/confucius.md
```

## 🔄 Typical Workflow

```bash
# 1. Initialize
ralph init --name "Error Messages v2"

# 2. Define the idea
ralph idea --problem "Cryptic errors" --user "Developers" --outcome "Clear messages"

# 3. Set first task
ralph task "Add error code enum"

# 4. Generate loop script
ralph loop --powershell  # Creates ralph-loop.ps1

# 5. Start the loop
.\ralph-loop.ps1

# 6. On success, commit
ralph commit -m "feat: Add error code enum"

# 7. Check status
ralph status
```

## 🆘 Recovery Scenarios

### Agent is Looping

```bash
ralph strike "Repeating same fix attempt"
ralph strike "Still not working"
ralph strike "Third failure"  # Triggers: ⚠️ MAX STRIKES REACHED
ralph reset --error "TypeError: Cannot read property..."
# Paste .ralph/subagent_context.md into fresh chat
```

### Token Rot (confucius.md too big)

```bash
ralph status  # Shows: Token Health: confucius.md 180/200 lines (90%)
ralph trim    # Archives and compresses
```

### Manual Intervention Needed

```bash
ralph pause   # Creates .ralph/PAUSE
# Fix things manually
ralph resume  # Removes .ralph/PAUSE
ralph unstrike  # Clear strikes after manual fix
```

## 📦 Related Packages

- [@aldine/confucius-mcp-browser](https://www.npmjs.com/package/@aldine/confucius-mcp-browser) - MCP server for browser automation and visual QA

## 📄 License

MIT
