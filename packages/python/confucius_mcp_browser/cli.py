"""CLI entry point for confucius-browser command."""
import subprocess
import sys


def main():
    """Main CLI entry point - delegates to TypeScript CLI."""
    cmd = ["npx", "-y", "@confucius/mcp-browser"] + sys.argv[1:]
    result = subprocess.run(cmd)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
