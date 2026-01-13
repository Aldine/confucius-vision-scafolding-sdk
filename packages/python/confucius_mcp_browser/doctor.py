"""Doctor check for Chrome DevTools connection."""
import subprocess
import sys


def run_doctor_check() -> bool:
    """
    Run diagnostic checks for Chrome DevTools connection.
    
    Returns:
        True if all checks pass, False otherwise
        
    Example:
        >>> run_doctor_check()
        🔍 Checking Chrome DevTools connection...
           Host: 127.0.0.1
           Port: 9222
        ✓ Chrome is accessible
        True
    """
    cmd = ["npx", "-y", "@confucius/mcp-browser", "doctor"]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    
    return result.returncode == 0


def _doctor_cli():
    """CLI entry point for python -m confucius_mcp_browser.doctor"""
    success = run_doctor_check()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    _doctor_cli()
