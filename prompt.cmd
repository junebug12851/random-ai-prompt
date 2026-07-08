@echo off
rem Convenience launcher so you can run the CLI as `./prompt` (or `.\prompt`) from the repo root.
rem It just forwards every argument to the Node CLI entry (targets/cli/bin/prompt.js).
node "%~dp0targets\cli\bin\prompt.js" %*
