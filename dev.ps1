# Next.js dev server (PowerShell 向け: カレントをプロジェクトにしてから起動)
# 例: .\dev.ps1
# 例: .\dev.ps1 -Port 3010
param(
    [int]$Port = 3000
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm run dev -- --port $Port
