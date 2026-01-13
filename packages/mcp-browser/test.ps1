# Confucius Vision Scaffolding SDK - Test Script
# PowerShell version for Windows

Write-Host "`n╔════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║  Confucius Vision Scaffolding SDK Test Suite  ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════╝`n" -ForegroundColor Blue

$passCount = 0
$failCount = 0
$skipCount = 0

function Test-Pass($message) {
    $script:passCount++
    Write-Host "✓ $message" -ForegroundColor Green
}

function Test-Fail($message, $error = $null) {
    $script:failCount++
    Write-Host "✗ $message" -ForegroundColor Red
    if ($error) {
        Write-Host "  $error" -ForegroundColor Red
    }
}

function Test-Skip($message) {
    $script:skipCount++
    Write-Host "○ $message" -ForegroundColor Yellow
}

function Write-Section($title) {
    Write-Host "`n━━━ $title ━━━`n" -ForegroundColor Blue
}

# Change to package directory
Set-Location $PSScriptRoot

Write-Section "Package Configuration Test"

# Check package.json
if (Test-Path "package.json") {
    $pkg = Get-Content "package.json" | ConvertFrom-Json
    
    if ($pkg.name -eq "@confucius/mcp-browser") {
        Test-Pass "Package name correct"
    } else {
        Test-Fail "Package name incorrect" "Expected @confucius/mcp-browser, got $($pkg.name)"
    }
    
    if ($pkg.bin.'confucius-browser') {
        Test-Pass "Binary entry point configured"
    } else {
        Test-Fail "Binary entry point missing"
    }
    
    if ($pkg.type -eq "module") {
        Test-Pass "Package type set to module (ESM)"
    } else {
        Test-Fail "Package type should be 'module'" "Got: $($pkg.type)"
    }
} else {
    Test-Fail "package.json not found"
}

Write-Section "Build Test"

# Check build output
$requiredFiles = @(
    "build/index.js",
    "build/mcp/server.js",
    "build/mcp/logging.js",
    "build/runtime/cdp_client.js",
    "build/runtime/allowlist.js",
    "build/runtime/browser_session.js",
    "build/cli/config-writers.js"
)

$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        Test-Fail "Build file missing: $file"
        $allFilesExist = $false
    }
}

if ($allFilesExist) {
    Test-Pass "All build files present"
    Write-Host "  Build directory: $(Resolve-Path build)"
}

Write-Section "Chrome Connection Check"

# Check Chrome connection
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:9222/json/version" -TimeoutSec 2 -ErrorAction Stop
    $data = $response.Content | ConvertFrom-Json
    Test-Pass "Chrome DevTools accessible at 127.0.0.1:9222"
    Write-Host "  Browser: $($data.Browser)"
    Write-Host "  Protocol: $($data.'Protocol-Version')"
    $chromeRunning = $true
} catch {
    Test-Skip "Chrome not running with remote debugging"
    Write-Host "  To start Chrome:"
    Write-Host "  chrome --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1`n"
    $chromeRunning = $false
}

Write-Section "Doctor Command Test"

# Test doctor command
try {
    $result = & node build/index.js doctor 2>&1
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Test-Pass "Doctor command passed (Chrome is accessible)"
        Write-Host $result
    } elseif ($result -like "*Cannot connect to Chrome DevTools*") {
        Test-Pass "Doctor command correctly detects Chrome is not running"
    } else {
        Test-Fail "Doctor command failed unexpectedly" $result
    }
} catch {
    Test-Fail "Doctor command error" $_.Exception.Message
}

Write-Section "Init Command Test"

# Test init command
$testDir = Join-Path $PSScriptRoot ".test-config"
$vscodeDir = Join-Path $testDir ".vscode"
$mcpConfigPath = Join-Path $vscodeDir "mcp.json"
$claudeConfigPath = Join-Path $testDir ".mcp.json"

# Clean up
if (Test-Path $testDir) {
    Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
}

try {
    New-Item -ItemType Directory -Path $testDir -Force | Out-Null
    
    # Test VS Code init
    $null = & node build/index.js init --host vscode --workspace $testDir 2>&1
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $mcpConfigPath)) {
        $config = Get-Content $mcpConfigPath | ConvertFrom-Json
        if ($config.servers.'confucius-browser') {
            Test-Pass "Init command creates VS Code config correctly"
            Write-Host "  Config file: $mcpConfigPath"
        } else {
            Test-Fail "VS Code config missing servers"
        }
    } else {
        Test-Fail "Init command failed for VS Code"
    }
    
    # Test Claude init
    $null = & node build/index.js init --host claude --workspace $testDir 2>&1
    
    if ($LASTEXITCODE -eq 0 -and (Test-Path $claudeConfigPath)) {
        $config = Get-Content $claudeConfigPath | ConvertFrom-Json
        if ($config.mcpServers.'confucius-browser') {
            Test-Pass "Init command creates Claude config correctly"
            Write-Host "  Config file: $claudeConfigPath"
        } else {
            Test-Fail "Claude config missing mcpServers"
        }
    } else {
        Test-Fail "Init command failed for Claude"
    }
    
} catch {
    Test-Fail "Init command test error" $_.Exception.Message
} finally {
    # Clean up
    if (Test-Path $testDir) {
        Remove-Item $testDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if ($chromeRunning) {
    Write-Section "MCP Server Test"
    Test-Skip "MCP server test requires manual verification"
    Write-Host "  To test MCP server:"
    Write-Host "  1. Run: node build/index.js start"
    Write-Host "  2. Send JSON-RPC requests via stdin"
    Write-Host "  3. Verify tool registration (open_url, screenshot, etc.)`n"
}

# Summary
Write-Host "`n━━━ Test Summary ━━━`n" -ForegroundColor Blue
Write-Host "✓ Passed: $passCount" -ForegroundColor Green
if ($failCount -gt 0) {
    Write-Host "✗ Failed: $failCount" -ForegroundColor Red
}
if ($skipCount -gt 0) {
    Write-Host "○ Skipped: $skipCount" -ForegroundColor Yellow
}
Write-Host "`nTotal: $($passCount + $failCount + $skipCount) tests`n"

if ($failCount -gt 0) {
    exit 1
}
