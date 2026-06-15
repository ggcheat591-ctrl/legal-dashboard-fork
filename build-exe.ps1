Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "=========================================="
Write-Host " Legal Dashboard - Windows EXE build"
Write-Host "=========================================="
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js LTS from https://nodejs.org/"
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm was not found. Reinstall Node.js LTS from https://nodejs.org/"
  Read-Host "Press Enter to exit"
  exit 1
}

Write-Host "Installing dependencies..."
npm install
if ($LASTEXITCODE -ne 0) {
  Read-Host "npm install failed. Press Enter to exit"
  exit 1
}

Write-Host ""
Write-Host "Building Windows EXE..."
npm run dist:win
if ($LASTEXITCODE -ne 0) {
  Read-Host "EXE build failed. Press Enter to exit"
  exit 1
}

Write-Host ""
Write-Host "Done. Output folder:"
Write-Host "$PWD\release"
Read-Host "Press Enter to exit"
