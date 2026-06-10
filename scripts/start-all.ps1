# Atalho Windows — delega para start-all.mjs
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
node scripts/start-all.mjs @args
