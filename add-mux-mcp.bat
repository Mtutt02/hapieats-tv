@echo off
echo Adding Mux MCP server to Claude Code...
claude mcp add mux --url "https://mcp.mux.com?client=claude-code"
echo.
echo Done! Restart Claude to load the Mux MCP server.
echo You'll be prompted to log in to Mux on first use.
pause
