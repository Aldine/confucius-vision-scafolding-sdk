# Confucius Browser MCP - Python Wrapper

Python wrapper for the Confucius Browser MCP server, providing easy integration with Python projects and the Claude Agent SDK.

## Installation

```bash
pip install confucius-mcp-browser
```

## Quick Start

### Install MCP Configuration

```python
from confucius_mcp_browser import install_mcp_config

# For Claude
install_mcp_config(host="claude")

# For VS Code
install_mcp_config(host="vscode")

# Custom workspace
install_mcp_config(host="claude", workspace="/path/to/project")
```

### CLI Usage

```bash
# Install for Claude
python -m confucius_mcp_browser.install --host claude

# Install for VS Code
python -m confucius_mcp_browser.install --host vscode --workspace /path/to/project

# Run health check
python -m confucius_mcp_browser.doctor
```

### Direct CLI Access

```bash
# The package provides confucius-browser command
confucius-browser doctor
confucius-browser init --host claude
```

## Doctor Check

```python
from confucius_mcp_browser import run_doctor_check

if run_doctor_check():
    print("✓ Chrome is accessible")
else:
    print("✗ Chrome not accessible")
```

## What This Package Does

This is a **thin Python wrapper** around the TypeScript MCP server. It:

1. ✅ **Installs MCP configuration** for Claude/VS Code
2. ✅ **Runs health checks** for Chrome DevTools
3. ✅ **Provides CLI access** to the TypeScript tools
4. ❌ Does NOT reimplement the MCP server in Python

The actual MCP server runs via `npx @confucius/mcp-browser` (installed automatically).

## Usage with Claude Agent SDK

After installing the configuration, use MCP tools in your Claude agent:

```python
# In your Claude agent code
async def test_visual_qa():
    # Claude agent will use MCP tools automatically
    response = await agent.chat("""
    Navigate to http://localhost:5173
    Take a screenshot
    Run a contrast audit
    """)
    
    return response
```

## Requirements

- Python 3.10+
- Node.js 18+ (for the TypeScript MCP server)
- Chrome with remote debugging enabled

## Chrome Setup

```bash
# macOS
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1

# Windows
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  --remote-debugging-port=9222 `
  --remote-debugging-address=127.0.0.1

# Linux
google-chrome \
  --remote-debugging-port=9222 \
  --remote-debugging-address=127.0.0.1
```

## API Reference

### `install_mcp_config(host, workspace, server_name)`

Install MCP configuration file.

**Parameters:**
- `host` (str): "vscode" or "claude"
- `workspace` (str | Path, optional): Workspace root (default: current directory)
- `server_name` (str, optional): Server name in config (default: "confucius-browser")

**Returns:** Path to created configuration file

### `run_doctor_check()`

Run diagnostic checks for Chrome DevTools connection.

**Returns:** bool - True if all checks pass

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHROME_HOST` | Chrome DevTools host | `127.0.0.1` |
| `CHROME_PORT` | Chrome DevTools port | `9222` |
| `CONFUCIUS_ALLOW_ORIGINS` | Allowed origins | `http://localhost:5173,...` |

## Troubleshooting

### "Chrome not accessible"

1. Start Chrome with remote debugging
2. Verify connection: `curl http://127.0.0.1:9222/json/version`
3. Run: `python -m confucius_mcp_browser.doctor`

### "npx not found"

Install Node.js 18+: https://nodejs.org/

### "Configuration file exists"

The tool updates existing configuration files automatically.

## Complete Documentation

For full documentation, see the TypeScript package:
- [Main README](../mcp-browser/README.md)
- [Security Policy](../mcp-browser/SECURITY.md)
- [Tool Reference](../mcp-browser/README.md#available-tools)

## License

MIT
