@echo off
title AI Physics Learning
if exist "%ProgramFiles%\nodejs\node.exe" (
  "%ProgramFiles%\nodejs\node.exe" "%~dp0setup\start-menu.mjs" %*
) else (
  node "%~dp0setup\start-menu.mjs" %*
)
if errorlevel 1 pause
