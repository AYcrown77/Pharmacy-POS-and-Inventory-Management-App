<#
    Builds both apps for production. Run this once at setup, and again after
    every `git pull`.

    The API's port is baked into the platform's build — Next resolves the
    /api proxy at build time — so the two .env files are checked against each
    other before anything is built.
#>
param(
    [string]$AppDir = (Split-Path $PSScriptRoot -Parent),
    [string]$BackendDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\mutaan-backend")
)

$ErrorActionPreference = "Stop"
$AppDir = (Resolve-Path $AppDir).Path
$BackendDir = (Resolve-Path $BackendDir).Path

# The repos carry pnpm lockfiles; installing with npm instead would rebuild
# node_modules in a different layout and leave a stray package-lock.json.
function Get-PackageManager {
    param([string]$Dir)
    if ((Test-Path (Join-Path $Dir "pnpm-lock.yaml")) -and (Get-Command pnpm -ErrorAction SilentlyContinue)) {
        return "pnpm"
    }
    return "npm"
}

function Get-EnvValue {
    param([string]$File, [string]$Key)
    if (-not (Test-Path $File)) { return $null }
    $line = Select-String -Path $File -Pattern "^\s*$Key\s*=(.*)$" | Select-Object -First 1
    if (-not $line) { return $null }
    return $line.Matches[0].Groups[1].Value.Trim()
}

Write-Host "`n== API ($BackendDir)" -ForegroundColor Cyan
$apiEnv = Join-Path $BackendDir ".env"
if (-not (Test-Path $apiEnv)) { throw "$apiEnv is missing. Copy .env.example to .env and fill it in." }
$apiPort = Get-EnvValue -File $apiEnv -Key "PORT"
if (-not $apiPort) { $apiPort = "5000" }

$apiPm = Get-PackageManager -Dir $BackendDir
Write-Host "  using $apiPm"
Push-Location $BackendDir
& $apiPm install
if ($LASTEXITCODE -ne 0) { throw "$apiPm install failed for the API" }
& $apiPm run build
if ($LASTEXITCODE -ne 0) { throw "API build failed" }
& $apiPm run migrate
if ($LASTEXITCODE -ne 0) { throw "Database migration failed" }
Pop-Location

Write-Host "`n== Checking the platform points at the API's port ($apiPort)" -ForegroundColor Cyan
$appEnv = Join-Path $AppDir ".env.local"
if (-not (Test-Path $appEnv)) {
    "API_PROXY_ORIGIN=http://127.0.0.1:$apiPort" | Set-Content -Path $appEnv -Encoding utf8
    Write-Host "  created .env.local pointing at http://127.0.0.1:$apiPort"
}
$proxy = Get-EnvValue -File $appEnv -Key "API_PROXY_ORIGIN"
if ($proxy -notmatch ":$apiPort(/|$)") {
    throw "API_PROXY_ORIGIN in .env.local is '$proxy', but the API runs on port $apiPort. Fix .env.local, then run this again."
}
Write-Host "  $proxy" -ForegroundColor Green

Write-Host "`n== Platform ($AppDir)" -ForegroundColor Cyan
$appPm = Get-PackageManager -Dir $AppDir
Write-Host "  using $appPm"
Push-Location $AppDir

# A dev server writes its own route types under .next\dev and leaves them
# half-written if it is ever killed — which then fails the production type
# check, because tsconfig includes them. They are dev-only output, so clear
# them before building.
$devOutput = Join-Path $AppDir ".next\dev"
if (Test-Path $devOutput) {
    Remove-Item $devOutput -Recurse -Force
    Write-Host "  cleared stale dev output"
}
& $appPm install
if ($LASTEXITCODE -ne 0) { throw "$appPm install failed for the platform" }
& $appPm run build
if ($LASTEXITCODE -ne 0) { throw "Platform build failed" }

Pop-Location

Write-Host "`nBuilt. Start or restart the services with deploy\install.ps1 or deploy\update.ps1.`n" -ForegroundColor Green
