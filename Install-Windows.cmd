@echo off
setlocal
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 and reopen the terminal.
  exit /b 1
)
set "PUPPETEER_SKIP_DOWNLOAD=1"
call npm.cmd ci --prefix "%~dp0.runtime" --ignore-scripts --no-audit --no-fund
if errorlevel 1 exit /b 1
call npm.cmd ci --prefix "%~dp0.runtime\web-tools" --ignore-scripts --no-audit --no-fund
if errorlevel 1 exit /b 1
call npm.cmd ci --prefix "%~dp0.pi\extensions\visual-tools" --ignore-scripts --no-audit --no-fund --omit=dev
if errorlevel 1 exit /b 1
echo Installation complete. Run Start-Learn.cmd.
