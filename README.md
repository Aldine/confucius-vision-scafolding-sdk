# Confucius Vision Scaffolding SDK

Production-ready Model Context Protocol (MCP) SDK for browser automation, visual QA, and accessibility testing. Integrates seamlessly with VS Code Copilot and Claude Code.

## 🚀 Quick Start

### TypeScript/Node.js

```bash
npm install @confucius/mcp-browser

# Set up for VS Code Copilot
npx @confucius/mcp-browser init --host vscode

# Set up for Claude Code
npx @confucius/mcp-browser init --host claude
```

### Python

```bash
pip install confucius-mcp-browser

# Set up for VS Code Copilot
confucius-browser init --host vscode

# Set up for Claude Code
confucius-browser init --host claude
```

## 📦 Packages

This monorepo contains two packages:

### [@confucius/mcp-browser](./packages/mcp-browser)
TypeScript MCP server providing browser automation via Chrome DevTools Protocol. Core implementation with 4 production tools:
- `open_url` - Navigate to URLs with wait conditions
- `screenshot` - Capture full page or viewport screenshots
- `console_errors` - Collect console messages and errors
- `contrast_audit` - WCAG contrast checking for accessibility

[Read the TypeScript documentation →](./packages/mcp-browser/README.md)

### [confucius-mcp-browser](./packages/python)
Python wrapper providing convenient CLI and programmatic access to the TypeScript MCP server. Thin delegation layer that maintains Python ecosystem compatibility.

[Read the Python documentation →](./packages/python/README.md)

## 🔧 Prerequisites

- **Node.js**: 18.18.0+ (for TypeScript package)
- **Python**: 3.10+ (for Python package, optional)
- **Google Chrome**: Latest stable version
- **Chrome Remote Debugging**: Launch Chrome with `--remote-debugging-port=9222`

## 🛡️ Security

The SDK implements defense-in-depth security:
- **Localhost-only by default**: Only allows `http://localhost` and `http://127.0.0.1`
- **Approval tokens**: External URLs require explicit approval via `CONFUCIUS_APPROVAL_TOKEN`
- **Secrets redaction**: Automatically redacts sensitive data from logs
- **Chrome binding**: Requires Chrome to bind to 127.0.0.1 only

[Read the full security policy →](./packages/mcp-browser/SECURITY.md)

## 📖 Documentation

- **[TypeScript MCP Server README](./packages/mcp-browser/README.md)** - Core implementation guide
- **[Python Wrapper README](./packages/python/README.md)** - Python-specific usage
- **[Security Policy](./packages/mcp-browser/SECURITY.md)** - Security model and best practices
- **[Chrome Setup](./packages/mcp-browser/README.md#chrome-setup)** - Launch Chrome with remote debugging

## 🎯 Use Cases

### Visual QA & Accessibility Testing
```typescript
// In VS Code Copilot or Claude Code
"Navigate to https://example.com and check for WCAG contrast violations"
"Take a screenshot of the login page"
"Check for console errors on the dashboard"
```

### UI Integrity Checks
```typescript
"Open http://localhost:3000/dashboard and verify all images loaded"
"Check if the navigation menu has sufficient color contrast"
"Capture a screenshot of the mobile viewport"
```

### Automated Testing Context
```typescript
"Navigate to the checkout flow and check for JavaScript errors"
"Audit the accessibility of all form inputs"
"Compare the screenshot against the design mockup"
```

## 🏗️ Architecture

```
confucius-vision-scaffolding-sdk/
├── packages/
│   ├── mcp-browser/           # TypeScript MCP Server
│   │   ├── src/
│   │   │   ├── mcp/          # MCP protocol implementation
│   │   │   ├── runtime/       # CDP client, allowlist, sessions
│   │   │   ├── cli/          # Config writers (init/doctor)
│   │   │   ├── index.ts      # CLI entry point
│   │   │   └── public.ts     # Public API exports
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── README.md
│   │   └── SECURITY.md
│   └── python/                # Python Wrapper
│       ├── confucius_mcp_browser/
│       │   ├── install.py    # MCP config installer
│       │   ├── doctor.py     # Health checker
│       │   └── cli.py        # CLI delegation
│       ├── pyproject.toml
│       └── README.md
└── README.md                  # This file
```

## 🧪 Development

### Build TypeScript Package
```bash
cd packages/mcp-browser
npm install
npm run build
```

### Install Python Package Locally
```bash
cd packages/python
pip install -e .
```

### Run Health Check
```bash
npx @confucius/mcp-browser doctor
# or
confucius-browser doctor
```

## 🤝 Integration Examples

### VS Code Copilot
1. Run `npx @confucius/mcp-browser init --host vscode`
2. Restart VS Code
3. Start Chrome with remote debugging: `chrome.exe --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1`
4. Use natural language prompts with Copilot

### Claude Code
1. Run `npx @confucius/mcp-browser init --host claude`
2. Restart Claude
3. Start Chrome with remote debugging
4. Use MCP tools in Claude conversations

## 📄 License

MIT License - see individual package READMEs for details

## 🔗 Links

- **GitHub Repository**: https://github.com/Aldine/confucius-vision-scaffolding-sdk
- **TypeScript Package**: [@confucius/mcp-browser](./packages/mcp-browser)
- **Python Package**: [confucius-mcp-browser](./packages/python)
- **Security Policy**: [SECURITY.md](./packages/mcp-browser/SECURITY.md)

## 🐛 Issues & Support

Report issues on GitHub: https://github.com/Aldine/confucius-vision-scaffolding-sdk/issues

## 🚦 Status

**Production Ready** - Follow security best practices and test thoroughly in your environment.

---

**Built with ❤️ for visual QA, accessibility testing, and UI integrity checks**
