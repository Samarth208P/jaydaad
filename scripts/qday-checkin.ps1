# Run from PowerShell during the official 18 November UTC drill.
$ErrorActionPreference = 'Stop'
$now = [DateTime]::UtcNow
if ($now.ToString('yyyy-MM-dd') -ne '2026-11-18') {
    throw 'The official proof window is 18 November 2026 UTC. Run this during the drill.'
}
Push-Location (Split-Path $PSScriptRoot -Parent)
try {
    node scripts/diana-cli.js checkin --config .local/qday-2026/diana.json --vault 0xF98A128cc7764836c8E8c6c3EFBE5283cCea630D
    if ($LASTEXITCODE -ne 0) { throw 'Review the saved receipts and window status before retrying.' }
    Write-Output 'Submit the checkin confirmed hash on the Jaydaad project page. Keep the saved public receipt.'
} finally {
    Pop-Location
}
