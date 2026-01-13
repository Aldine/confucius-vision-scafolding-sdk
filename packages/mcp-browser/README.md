# Confucius Browser MCP SDK

> **Production-ready MCP server for browser automation, visual QA, and WCAG accessibility testing**

[![MCP](https://img.shields.io/badge/MCP-1.0-blue)](https://modelcontextprotocol.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Security](https://img.shields.io/badge/security-hardened-green)](./SECURITY.md)

## 🎯 What Is This?

Confucius Browser is a Model Context Protocol (MCP) server that enables AI agents (Copilot, Claude, etc.) to:

- 🌐 **Automate browsers** via Chrome DevTools Protocol
- 📸 **Capture screenshots** (full page & viewport)
- ✅ **Check WCAG contrast** ratios (AA & AAA compliance)
- 🔍 **Monitor console errors** and warnings
- 🎨 **Audit accessibility** with automated contrast checks
- 🔒 **Stay secure** with localhost-only defaults and approval tokens

## 🚀 Quick Start

### For VS Code Copilot

```bash
# 1. Install and initialize
npx @confucius/mcp-browser init --host vscode

# 2. Start Chrome with remote debugging
chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1

# 3. Reload VS Code, then use Copilot chat:
# "Take a screenshot of localhost:5173"
# "Check WCAG contrast on the dashboard"
# "Find console errors on the page"
```

### For Claude Code

```bash
# 1. Install and initialize
npx @confucius/mcp-browser init --host claude

# 2. Start Chrome with remote debugging  
chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1

# 3. Open project in Claude Code, then chat:
# "Navigate to localhost:5173 and take a screenshot"
# "Run a contrast audit on the page"
```

### For Python Projects

```bash
# Install Python wrapper
pip install confucius-mcp-browser

# Initialize for Claude
python -m confucius_mcp_browser.install --host claude

# Or use programmatically
python
>>> from confucius_mcp_browser import install_mcp_config
>>> install_mcp_config(host="claude")
```

## 📦 SDK Architecture

```
@confucius/mcp-browser (TypeScript)
├── MCP Server (stdio transport)
├── CLI (init, doctor, start)
└── CDP Client (WebSocket)

confucius-mcp-browser (Python)
└── Thin wrapper around TypeScript CLI
```

## 🛠️ Available Tools

### `open_url`
Navigate to a URL and wait for page load.

**Input:**
- `url` (string): URL to navigate to
- `wait_until` (string): "load" | "domcontentloaded" | "networkidle" (default)
- `approval_token` (string, optional): Token for non-localhost URLs
- `timeout_ms` (number, optional): Timeout in milliseconds (default: 30000)

**Example:**
```json
{
  "tool": "open_url",
  "arguments": {
    "url": "http://localhost:5173",
    "wait_until": "networkidle"
  }
}
```

### `screenshot`
Capture a screenshot of the current page.

**Input:**
- `full_page` (boolean, optional): Capture full scrollable page (default: false)
- `format` (string, optional): "png" (default)

**Output:** Base64-encoded PNG image

**Example:**
```json
{
  "tool": "screenshot",
  "arguments": {
    "full_page": true
  }
}
```

### `console_errors`
Get console errors and warnings from the page.

**Input:**
- `include_warnings` (boolean, optional): Include warnings (default: false)

**Output:** Array of console messages with level, message, timestamp

**Example:**
```json
{
  "tool": "console_errors",
  "arguments": {
    "include_warnings": true
  }
}
```

### `contrast_audit`
Run WCAG contrast ratio audit on the page.

**Input:**
- `scope_selector` (string, optional): CSS selector to limit scope (default: "body")
- `standard` (string, optional): "WCAG21AA" | "WCAG22AA" (default: "WCAG21AA")

**Output:** Array of contrast issues with ratios and suggested fixes

**Example:**
```json
{
  "tool": "contrast_audit",
  "arguments": {
    "scope_selector": "main",
    "standard": "WCAG21AA"
  }
}
```

## 🔒 Security Model

### Localhost-Only by Default

By default, only localhost URLs are allowed:
- `http://localhost:5173`
- `http://127.0.0.1:5173`

### Custom Allowlist

```bash
export CONFUCIUS_ALLOW_ORIGINS="http://localhost:3000,http://127.0.0.1:5173"
```

### Approval Tokens

Non-localhost URLs require approval:

```bash
export CONFUCIUS_REQUIRE_APPROVAL=true
export CONFUCIUS_APPROVAL_TOKEN="your-secret-token"
```

Then pass the token:
```json
{
  "tool": "open_url",
  "arguments": {
    "url": "https://example.com",
    "approval_token": "your-secret-token"
  }
}
```

### Disable Approvals (Use with caution!)

```bash
export CONFUCIUS_REQUIRE_APPROVAL=false
```

## 🧪 Testing & Diagnostics

### Doctor Check

```bash
npx @confucius/mcp-browser doctor

# Output:
# 🔍 Checking Chrome DevTools connection...
#    Host: 127.0.0.1
#    Port: 9222
# ✓ Chrome is accessible
#    Browser: Chrome/131.0.0.0
#    Protocol: 1.3
# ✓ All checks passed!
```

### Python Doctor

```bash
python -m confucius_mcp_browser.doctor
```

## 💻 CLI Reference

### `init`
Initialize MCP configuration for a host.

```bash
npx @confucius/mcp-browser init --host vscode
npx @confucius/mcp-browser init --host claude --workspace /path/to/project
```

**Options:**
- `--host <host>`: Target host (vscode | claude)
- `--workspace <path>`: Workspace root (default: current directory)
- `--server-name <name>`: Server name in config (default: confucius-browser)

### `doctor`
Check Chrome DevTools connection and configuration.

```bash
npx @confucius/mcp-browser doctor
```

### `start`
Start the MCP server (stdio transport).

```bash
npx @confucius/mcp-browser start
```

**Note:** This is called automatically by MCP hosts. You rarely need to run it manually.

## 🔌 MCP Host Configurations

### VS Code (.vscode/mcp.json)

```json
{
  "servers": {
    "confucius-browser": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@confucius/mcp-browser", "start"],
      "env": {
        "CHROME_HOST": "127.0.0.1",
        "CHROME_PORT": "9222",
        "CONFUCIUS_ALLOW_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173"
      }
    }
  }
}
```

### Claude (.mcp.json)

```json
{
  "mcpServers": {
    "confucius-browser": {
      "command": "npx",
      "args": ["-y", "@confucius/mcp-browser", "start"],
      "env": {
        "CHROME_HOST": "127.0.0.1",
        "CHROME_PORT": "9222",
        "CONFUCIUS_ALLOW_ORIGINS": "http://localhost:5173,http://127.0.0.1:5173"
      }
    }
  }
}
```

## 🐍 Python Usage

### Installation

```bash
pip install confucius-mcp-browser
```

### Install Config

```python
from confucius_mcp_browser import install_mcp_config

# For Claude
install_mcp_config(host="claude")

# For VS Code
install_mcp_config(host="vscode", workspace="/path/to/project")
```

### Doctor Check

```python
from confucius_mcp_browser import run_doctor_check

if run_doctor_check():
    print("All systems go!")
else:
    print("Chrome not accessible")
```

## 📚 Example Prompts

### Visual QA

```
Navigate to http://localhost:5173
Take a full-page screenshot
Check for console errors
Run a contrast audit
Summarize any issues found
```

### Accessibility Testing

```
Open localhost:5173
Run WCAG contrast audit on the main content area
For any failures, suggest color adjustments that pass AA
Take before and after screenshots
```

### Automated Testing

```
Navigate to localhost:3000/dashboard
Wait for network idle
Screenshot the page
Check console for errors
If errors exist, take additional screenshots of problem areas
```

## 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CHROME_HOST` | Chrome DevTools host | `127.0.0.1` |
| `CHROME_PORT` | Chrome DevTools port | `9222` |
| `CONFUCIUS_ALLOW_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,...` |
| `CONFUCIUS_REQUIRE_APPROVAL` | Require approval for non-localhost | `true` |
| `CONFUCIUS_APPROVAL_TOKEN` | Approval token value | `confucius-default-token` |
| `LOG_LEVEL` | Logging level (debug\|info\|warn\|error) | `info` |

## 🚨 Troubleshooting

### Chrome Not Accessible

**Problem:** `BROWSER_NOT_DEBUGGABLE` error

**Solution:**
1. Start Chrome with remote debugging:
   ```bash
   chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1
   ```
2. Verify with: `curl http://127.0.0.1:9222/json/version`
3. Run: `npx @confucius/mcp-browser doctor`

### Origin Not Allowed

**Problem:** `NOT_ALLOWED` error for URL

**Solution:**
Add origin to allowlist:
```bash
export CONFUCIUS_ALLOW_ORIGINS="http://localhost:3000,http://127.0.0.1:5173"
```

### Approval Required

**Problem:** `APPROVAL_REQUIRED` error

**Solution:**
1. Set approval token:
   ```bash
   export CONFUCIUS_APPROVAL_TOKEN="my-secret"
   ```
2. Pass token in tool call:
   ```json
   { "approval_token": "my-secret" }
   ```

Or disable approvals (not recommended):
```bash
export CONFUCIUS_REQUIRE_APPROVAL=false
```

## 🏗️ Development

### Build TypeScript Package

```bash
cd packages/mcp-browser
npm install
npm run build
```

### Test Locally

```bash
# Link package globally
cd packages/mcp-browser
npm link

# Use linked version
confucius-browser doctor
```

### Build Python Package

```bash
cd packages/python
pip install -e .
```

## 📖 Additional Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Security Best Practices](./SECURITY.md)

## 🤝 Contributing

Contributions welcome! Please read our security policy before contributing.

## 📝 License

MIT

---

**Status**: Production Ready ✅  
**MCP Version**: 1.0  
**Last Updated**: January 13, 2026

*Built with ❤️ for accessible, high-quality web applications*
