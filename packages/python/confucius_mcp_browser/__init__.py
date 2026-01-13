"""
Confucius MCP Browser - Python wrapper for the TypeScript MCP server.

This package provides a thin Python wrapper around the TypeScript MCP server,
making it easy to integrate browser automation and visual QA into Python projects.
"""

__version__ = "0.1.0"

from .install import install_mcp_config
from .doctor import run_doctor_check

__all__ = [
    "install_mcp_config",
    "run_doctor_check",
]
