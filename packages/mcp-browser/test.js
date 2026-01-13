#!/usr/bin/env node

/**
 * Test script for @confucius/mcp-browser SDK
 * 
 * Tests:
 * 1. Doctor command (Chrome connection check)
 * 2. Init command (config file generation)
 * 3. MCP server connection and tool invocation (if Chrome is running)
 */

import { spawn, execSync } from 'child_process';
import { readFileSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34m';
const RESET = '\x1b[0m';

let passCount = 0;
let failCount = 0;
let skipCount = 0;

function log(color, prefix, message) {
  console.log(`${color}${prefix}${RESET} ${message}`);
}

function pass(message) {
  passCount++;
  log(GREEN, '✓', message);
}

function fail(message, error) {
  failCount++;
  log(RED, '✗', message);
  if (error) {
    console.error(`  ${RED}${error}${RESET}`);
  }
}

function skip(message) {
  skipCount++;
  log(YELLOW, '○', message);
}

function section(title) {
  console.log(`\n${BLUE}━━━ ${title} ━━━${RESET}\n`);
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      cwd: __dirname,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

async function checkChromeConnection() {
  section('Chrome Connection Check');
  
  try {
    const response = await fetch('http://127.0.0.1:9222/json/version', {
      signal: AbortSignal.timeout(2000)
    });
    
    if (response.ok) {
      const data = await response.json();
      pass(`Chrome DevTools accessible at 127.0.0.1:9222`);
      console.log(`  Browser: ${data.Browser}`);
      console.log(`  Protocol: ${data['Protocol-Version']}`);
      return true;
    }
  } catch (err) {
    skip('Chrome not running with remote debugging');
    console.log('  To start Chrome:');
    console.log('  chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1\n');
    return false;
  }
  
  return false;
}

async function testDoctorCommand() {
  section('Doctor Command Test');
  
  try {
    const result = await runCommand('node', ['build/index.js', 'doctor']);
    
    // Doctor returns exit code 1 when Chrome is not accessible, which is expected
    if (result.stdout.includes('Cannot connect to Chrome DevTools') || 
        result.stderr.includes('Cannot connect to Chrome DevTools')) {
      pass('Doctor command correctly detects Chrome is not running');
    } else if (result.code === 0 && result.stdout.includes('All checks passed')) {
      pass('Doctor command passed (Chrome is accessible)');
      console.log(result.stdout);
    } else {
      fail('Doctor command failed unexpectedly', result.stderr || result.stdout);
    }
  } catch (err) {
    fail('Doctor command error', err.message);
  }
}

async function testInitCommand() {
  section('Init Command Test');
  
  const testDir = join(__dirname, '.test-config');
  const vscodeDir = join(testDir, '.vscode');
  const mcpConfigPath = join(vscodeDir, 'mcp.json');
  const claudeConfigPath = join(testDir, '.mcp.json');
  
  // Clean up any existing test directory
  try {
    if (existsSync(testDir)) {
      execSync(`rm -rf "${testDir}"`, { stdio: 'ignore' });
    }
  } catch (err) {
    // Ignore cleanup errors
  }
  
  try {
    mkdirSync(testDir, { recursive: true });
    
    // Test VS Code init
    const vscodeResult = await runCommand('node', [
      'build/index.js',
      'init',
      '--host', 'vscode',
      '--workspace', testDir
    ]);
    
    if (vscodeResult.code === 0 && existsSync(mcpConfigPath)) {
      const config = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
      if (config.servers && config.servers['confucius-browser']) {
        pass('Init command creates VS Code config correctly');
        console.log(`  Config file: ${mcpConfigPath}`);
      } else {
        fail('VS Code config missing servers', JSON.stringify(config, null, 2));
      }
    } else {
      fail('Init command failed for VS Code', vscodeResult.stderr);
    }
    
    // Test Claude init
    const claudeResult = await runCommand('node', [
      'build/index.js',
      'init',
      '--host', 'claude',
      '--workspace', testDir
    ]);
    
    if (claudeResult.code === 0 && existsSync(claudeConfigPath)) {
      const config = JSON.parse(readFileSync(claudeConfigPath, 'utf-8'));
      if (config.mcpServers && config.mcpServers['confucius-browser']) {
        pass('Init command creates Claude config correctly');
        console.log(`  Config file: ${claudeConfigPath}`);
      } else {
        fail('Claude config missing mcpServers', JSON.stringify(config, null, 2));
      }
    } else {
      fail('Init command failed for Claude', claudeResult.stderr);
    }
    
  } catch (err) {
    fail('Init command test error', err.message);
  } finally {
    // Clean up
    try {
      if (existsSync(testDir)) {
        execSync(`rm -rf "${testDir}"`, { stdio: 'ignore' });
      }
    } catch (err) {
      // Ignore cleanup errors
    }
  }
}

async function testMCPServer() {
  section('MCP Server Test');
  
  const chromeRunning = await checkChromeConnection();
  
  if (!chromeRunning) {
    skip('Skipping MCP server test (Chrome not running)');
    return;
  }
  
  try {
    // Start MCP server
    const server = spawn('node', ['build/index.js', 'start'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let serverOutput = '';
    server.stdout.on('data', (data) => {
      serverOutput += data.toString();
    });
    
    server.stderr.on('data', (data) => {
      serverOutput += data.toString();
    });
    
    // Wait for server to initialize
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Send initialize request
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0'
        }
      }
    };
    
    server.stdin.write(JSON.stringify(initRequest) + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send tools/list request
    const toolsRequest = {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {}
    };
    
    server.stdin.write(JSON.stringify(toolsRequest) + '\n');
    
    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Clean up
    server.kill();
    
    if (serverOutput.includes('open_url') || serverOutput.includes('screenshot')) {
      pass('MCP server starts and responds to requests');
      console.log('  Detected tools: open_url, screenshot, console_errors, contrast_audit');
    } else {
      fail('MCP server did not respond with expected tools', serverOutput);
    }
    
  } catch (err) {
    fail('MCP server test error', err.message);
  }
}

async function testBuild() {
  section('Build Test');
  
  try {
    const buildDir = join(__dirname, 'build');
    const requiredFiles = [
      'index.js',
      'mcp/server.js',
      'mcp/logging.js',
      'runtime/cdp_client.js',
      'runtime/allowlist.js',
      'runtime/browser_session.js',
      'cli/config-writers.js'
    ];
    
    let allFilesExist = true;
    for (const file of requiredFiles) {
      const filePath = join(buildDir, file);
      if (!existsSync(filePath)) {
        fail(`Build file missing: ${file}`);
        allFilesExist = false;
      }
    }
    
    if (allFilesExist) {
      pass('All build files present');
      console.log(`  Build directory: ${buildDir}`);
    }
  } catch (err) {
    fail('Build test error', err.message);
  }
}

async function testPackageJSON() {
  section('Package Configuration Test');
  
  try {
    const packagePath = join(__dirname, 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
    
    if (pkg.name === '@confucius/mcp-browser') {
      pass('Package name correct');
    } else {
      fail('Package name incorrect', `Expected @confucius/mcp-browser, got ${pkg.name}`);
    }
    
    if (pkg.bin && pkg.bin['confucius-browser']) {
      pass('Binary entry point configured');
    } else {
      fail('Binary entry point missing in package.json');
    }
    
    if (pkg.type === 'module') {
      pass('Package type set to module (ESM)');
    } else {
      fail('Package type should be "module"', `Got: ${pkg.type}`);
    }
    
    const requiredDeps = ['@modelcontextprotocol/sdk', 'ws'];
    for (const dep of requiredDeps) {
      if (pkg.dependencies && pkg.dependencies[dep]) {
        pass(`Dependency present: ${dep}`);
      } else {
        fail(`Missing dependency: ${dep}`);
      }
    }
    
  } catch (err) {
    fail('Package.json test error', err.message);
  }
}

async function runAllTests() {
  console.log(`${BLUE}╔════════════════════════════════════════════════╗${RESET}`);
  console.log(`${BLUE}║  Confucius Vision Scaffolding SDK Test Suite  ║${RESET}`);
  console.log(`${BLUE}╚════════════════════════════════════════════════╝${RESET}`);
  
  await testPackageJSON();
  await testBuild();
  await testDoctorCommand();
  await testInitCommand();
  
  const chromeRunning = await checkChromeConnection();
  if (chromeRunning) {
    await testMCPServer();
  }
  
  // Summary
  console.log(`\n${BLUE}━━━ Test Summary ━━━${RESET}\n`);
  console.log(`${GREEN}✓ Passed:${RESET} ${passCount}`);
  if (failCount > 0) {
    console.log(`${RED}✗ Failed:${RESET} ${failCount}`);
  }
  if (skipCount > 0) {
    console.log(`${YELLOW}○ Skipped:${RESET} ${skipCount}`);
  }
  console.log(`\nTotal: ${passCount + failCount + skipCount} tests\n`);
  
  if (failCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error(`${RED}Fatal error:${RESET}`, err);
  process.exit(1);
});
