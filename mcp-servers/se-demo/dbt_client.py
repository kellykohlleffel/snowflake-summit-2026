"""dbt CLI client for the SE Demo MCP server.

Handles: dbt_run, dbt_test via subprocess execution.
"""

import os
import asyncio
from typing import Optional


class DbtClient:
    """Lightweight dbt CLI client using subprocess."""

    def __init__(self):
        self.dbt_path = os.getenv("DBT_PATH", "dbt")
        self.project_dir = os.getenv("DBT_PROJECT_DIR", "")
        self.profiles_dir = os.getenv("DBT_PROFILES_DIR", "")

    def _validate(self) -> None:
        """Check that required paths are configured."""
        if not self.project_dir:
            raise ValueError("DBT_PROJECT_DIR not set")
        if not os.path.isdir(self.project_dir):
            raise ValueError(f"DBT_PROJECT_DIR does not exist: {self.project_dir}")

    async def _run_command(
        self,
        command: str,
        select: Optional[str] = None,
        exclude: Optional[str] = None,
        vars_json: Optional[str] = None,
        full_refresh: bool = False,
        timeout: int = 300,
    ) -> dict:
        """Execute a dbt CLI command and return results."""
        self._validate()

        cmd = [self.dbt_path, command]

        if select:
            cmd.extend(["--select", select])
        if exclude:
            cmd.extend(["--exclude", exclude])
        if vars_json:
            cmd.extend(["--vars", vars_json])
        if full_refresh:
            cmd.append("--full-refresh")
        if self.profiles_dir:
            cmd.extend(["--profiles-dir", self.profiles_dir])

        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.project_dir,
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(), timeout=timeout
            )

            return {
                "success": process.returncode == 0,
                "command": " ".join(cmd),
                "output": stdout.decode("utf-8"),
                "error": stderr.decode("utf-8") if stderr else None,
                "returncode": process.returncode,
            }

        except asyncio.TimeoutError:
            process.kill()
            return {
                "success": False,
                "command": " ".join(cmd),
                "output": "",
                "error": f"Command timed out after {timeout} seconds",
                "returncode": -1,
            }
        except Exception as e:
            return {
                "success": False,
                "command": " ".join(cmd),
                "output": "",
                "error": str(e),
                "returncode": -1,
            }

    async def run(
        self,
        select: Optional[str] = None,
        vars_json: Optional[str] = None,
        full_refresh: bool = False,
    ) -> dict:
        """Execute dbt run."""
        return await self._run_command(
            "run", select=select, vars_json=vars_json, full_refresh=full_refresh
        )

    async def test(self, select: Optional[str] = None, vars_json: Optional[str] = None) -> dict:
        """Execute dbt test."""
        return await self._run_command("test", select=select, vars_json=vars_json)
