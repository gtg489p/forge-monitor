# Forge Monitor Agent — Windows Service Installer (requires NSSM)
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install.ps1
# NSSM: https://nssm.cc/download
#Requires -RunAsAdministrator

param(
    [string]$ServiceName = "forge-agent",
    [string]$NssmPath    = "nssm"
)

$AgentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Ensure .env exists
if (-not (Test-Path "$AgentDir\.env")) {
    Copy-Item "$AgentDir\.env.example" "$AgentDir\.env"
    Write-Host ""
    Write-Host "[install] Created .env from template."
    Write-Host "[install] Edit '$AgentDir\.env' with your hub URL, node ID, and secret."
    Write-Host "[install] Then re-run this script."
    exit 0
}

# Locate bun
$BunPath = (Get-Command bun -ErrorAction SilentlyContinue)?.Source
if (-not $BunPath) {
    $BunPath = "$env:USERPROFILE\.bun\bin\bun.exe"
}
if (-not (Test-Path $BunPath)) {
    Write-Error "bun not found. Install bun: https://bun.sh/install"
    exit 1
}

Write-Host "[install] Using bun: $BunPath"

# Check NSSM
$NssmCmd = Get-Command $NssmPath -ErrorAction SilentlyContinue
if (-not $NssmCmd) {
    Write-Error "NSSM not found. Download from https://nssm.cc/download and add to PATH."
    exit 1
}

# Remove existing service if present
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "[install] Removing existing service '$ServiceName'..."
    & $NssmPath stop  $ServiceName 2>$null
    & $NssmPath remove $ServiceName confirm
}

# Install service
Write-Host "[install] Installing service '$ServiceName'..."
& $NssmPath install $ServiceName $BunPath "run `"$AgentDir\agent.ts`""
& $NssmPath set $ServiceName AppDirectory $AgentDir
& $NssmPath set $ServiceName AppRestartDelay 10000
& $NssmPath set $ServiceName DisplayName "Forge Monitor Agent"
& $NssmPath set $ServiceName Description "Forge Monitor push agent — collects and ships metrics to hub."

# Load env vars from .env into service environment
$envVars = Get-Content "$AgentDir\.env" |
    Where-Object { $_ -match '^\s*[A-Z]' -and $_ -notmatch '^\s*#' }
foreach ($line in $envVars) {
    & $NssmPath set $ServiceName AppEnvironmentExtra $line
}

& $NssmPath start $ServiceName

Write-Host ""
Write-Host "[install] Done! Service '$ServiceName' is running."
Write-Host "  Status:  Get-Service $ServiceName"
Write-Host "  Logs:    nssm edit $ServiceName  (AppStdout / AppStderr)"
Write-Host "  Stop:    Stop-Service $ServiceName"
