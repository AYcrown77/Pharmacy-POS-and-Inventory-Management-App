<#
    Builds both apps for production. Run this once at setup, and again after
    every `git pull`.

    The API's port is baked into the platform's build — Next resolves the
    /api proxy at build time — so the two .env files are checked against each
    other before anything is built.
#>
param(
    [string]$AppDir = (Split-Path $PSScriptRoot -Parent),
    [string]$BackendDir
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")
$AppDir = (Resolve-Path $AppDir).Path
$BackendDir = Resolve-BackendDir -Hint $BackendDir -AppDir $AppDir

# The repos carry pnpm lockfiles, so pnpm is preferred: installing with npm
# instead rebuilds node_modules in a different layout and resolves versions
# afresh. But a broken pnpm must not stop the pharmacy from being deployed.
function Get-PackageManager {
    param([string]$Dir)

    if (-not (Test-Path (Join-Path $Dir "pnpm-lock.yaml"))) { return "npm" }
    if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) { return "npm" }

    # That a `pnpm` command exists proves only that a shim is on the PATH. A
    # half-installed pnpm — its shim pointing back at itself — answers just the
    # same and then fails every command it is given. So ask it its version and
    # believe the answer. cmd runs it, because PowerShell 5.1 turns a native
    # command's stderr into errors that would stop the script here.
    $version = cmd /c "pnpm --version 2>&1"
    if ($LASTEXITCODE -eq 0 -and "$version" -match "^[0-9]+[.][0-9]+") { return "pnpm" }

    Write-Host "  pnpm is installed but not working: $version" -ForegroundColor Yellow
    Write-Host "  falling back to npm" -ForegroundColor Yellow
    return "npm"
}

# npm resolves peer dependencies more strictly than pnpm, and this tree was
# resolved by pnpm. One retry rather than a failed deployment.
function Invoke-Install {
    param([string]$Manager, [string]$What)

    & $Manager install
    if ($LASTEXITCODE -eq 0) { return }

    if ($Manager -eq "npm") {
        Write-Host "  npm install failed; retrying with --legacy-peer-deps" -ForegroundColor Yellow
        & npm install --legacy-peer-deps
        if ($LASTEXITCODE -eq 0) { return }
    }

    throw "$Manager install failed for the $What"
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
Invoke-Install -Manager $apiPm -What "API"
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
Invoke-Install -Manager $appPm -What "platform"
& $appPm run build
if ($LASTEXITCODE -ne 0) { throw "Platform build failed" }

Pop-Location

Write-Host "`nBuilt. Start or restart the services with deploy\install.ps1 or deploy\update.ps1.`n" -ForegroundColor Green
