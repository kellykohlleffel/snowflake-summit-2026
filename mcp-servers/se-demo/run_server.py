"""Entry point for Claude Desktop — loads .env and starts the MCP server."""

import os
import sys
from dotenv import load_dotenv

# Load .env from project directory (explicit path — Claude Desktop doesn't set cwd)
project_dir = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(project_dir, ".env"))

sys.path.insert(0, project_dir)
from se_demo_mcp_server import mcp

if __name__ == "__main__":
    mcp.run()
