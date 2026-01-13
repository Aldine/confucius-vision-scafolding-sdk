"""Install MCP configuration for different hosts."""
import json
import subprocess
import sys
from pathlib import Path
from typing import Literal


def install_mcp_config(
    host: Literal["vscode", "claude"] = "claude",
    workspace: str | Path | None = None,
    server_name: str = "confucius-browser"
) -> Path:
    """
    Install MCP configuration for VS Code or Claude.
    
    Args:
        host: Target host ("vscode" or "claude")
        workspace: Workspace/project root (default: current directory)
        server_name: Server name in config (default: "confucius-browser")
        
    Returns:
        Path to the created configuration file
        
    Example:
        >>> install_mcp_config(host="claude")
        PosixPath('/home/user/project/.mcp.json')
    """
    workspace_path = Path(workspace) if workspace else Path.cwd()
    
    cmd = [
        "npx",
        "-y",
        "@confucius/mcp-browser",
        "init",
        "--host", host,
        "--workspace", str(workspace_path),
        "--server-name", server_name
    ]
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        raise RuntimeError(f"Failed to install MCP config: {result.stderr}")
    
    print(result.stdout)
    
    # Return the config file path
    if host == "vscode":
        return workspace_path / ".vscode" / "mcp.json"
    else:
        return workspace_path / ".mcp.json"


def _install_cli():
    """CLI entry point for python -m confucius_mcp_browser.install"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Install Confucius Browser MCP configuration"
    )
    parser.add_argument(
        "--host",
        choices=["vscode", "claude"],
        default="claude",
        help="Target host (default: claude)"
    )
    parser.add_argument(
        "--workspace",
        default=None,
        help="Workspace/project root (default: current directory)"
    )
    parser.add_argument(
        "--server-name",
        default="confucius-browser",
        help="Server name in config (default: confucius-browser)"
    )
    
    args = parser.parse_args()
    
    try:
        config_path = install_mcp_config(
            host=args.host,
            workspace=args.workspace,
            server_name=args.server_name
        )
        print(f"\n✓ Configuration created: {config_path}")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    _install_cli()
