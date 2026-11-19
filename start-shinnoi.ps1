# Liga a Shinnoi Company com Novo agente, mensagens e terminal (http://localhost:4747).
# Uso: powershell -ExecutionPolicy Bypass -File start-shinnoi.ps1
Set-Location $PSScriptRoot
$env:HABBLAUD_PTY = '1'
$env:HABBLAUD_CLAUDE_BIN = "$env:APPDATA\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
if (-not (Test-Path 'dist\server\index.js')) { npm run build }
npm start
