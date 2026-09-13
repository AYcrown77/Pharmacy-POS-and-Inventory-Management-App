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

<#
    Which package manager to install with.

    These repos are pnpm projects, and that is not a preference: npm cannot
    install over a folder pnpm created. Its resolver walks pnpm's .pnpm symlink
    tree and dies with "Cannot read properties of null (reading 'matches')".

    So: the installed pnpm if it actually works; otherwise the exact version
    the project pins, fetched on demand by npx; and only if neither can run,
    npm — which then needs node_modules deleted first.
#>
function Get-PackageManager {
    param([string]$Dir)

    $npm = [pscustomobject]@{ Name = "npm"; Exe = "npm"; Prefix = @() }
    if (-not (Test-Path (Join-Path $Dir "pnpm-lock.yaml"))) { return $npm }

    # That a `pnpm` command exists proves only that a shim is on the PATH. A
    # half-installed pnpm — its shim pointing back at itself — answers just the
    # same and then fails every command. cmd runs it, because PowerShell 5.1
    # turns a native command's stderr into errors that would stop the script.
    if (Get-Command pnpm -ErrorAction SilentlyContinue) {
        $version = cmd /c "pnpm --version 2>&1"
        if ($LASTEXITCODE -eq 0 -and "$version" -match "^[0-9]+[.][0-9]+") {
            return [pscustomobject]@{ Name = "pnpm $version"; Exe = "pnpm"; Prefix = @() }
        }
        Write-Host "  pnpm is installed but not working: $version" -ForegroundColor Yellow
    }

    $pinned = "pnpm"
    try {
        $package = Get-Content (Join-Path $Dir "package.json") -Raw | ConvertFrom-Json
        if ($package.packageManager -match "^pnpm@") { $pinned = $package.packageManager }
    } catch {
        # No packageManager field; the latest pnpm will do.
    }

    # npx prints its own "npm warn exec" lines before the answer, so look for a
    # version on any line rather than at the start of the output.
    $output = @(cmd /c "npx --yes $pinned --version 2>&1")
    if ($LASTEXITCODE -eq 0 -and ($output | Where-Object { $_ -match "^[0-9]+[.][0-9]+" })) {
        Write-Host "  using $pinned through npx (needs the internet once)" -ForegroundColor Yellow
        return [pscustomobject]@{ Name = $pinned; Exe = "npx"; Prefix = @("--yes", $pinned) }
    }

    Write-Host "  pnpm could not be run at all, including through npx:" -ForegroundColor Yellow
    $output | Select-Object -Last 3 | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkYellow }
    Write-Host "  falling back to npm" -ForegroundColor Yellow
    return $npm
}

function Invoke-Pm {
    param($Pm, [string[]]$Arguments)
    # Splatting needs a variable: & $exe @(...) would pass the whole array as
    # one argument, so "run build" arrives as a single unknown command.
    $all = @($Pm.Prefix) + $Arguments
    & $Pm.Exe @all
}

function Invoke-Install {
    param($Pm, [string]$Dir, [string]$What)

    # npm's resolver walks pnpm's .pnpm symlink tree and dies on it
    # ("Cannot read properties of null"). If npm is what we have, the tree pnpm
    # built has to go; npm then installs its own from package.json.
    $pnpmTree = Join-Path $Dir "node_modules\.pnpm"
    if ($Pm.Exe -eq "npm" -and (Test-Path $pnpmTree)) {
        Write-Host "  removing the pnpm-built node_modules so npm can install" -ForegroundColor Yellow
        Remove-Item (Join-Path $Dir "node_modules") -Recurse -Force
    }

    Invoke-Pm -Pm $Pm -Arguments @("install")
    if ($LASTEXITCODE -eq 0) { return }

    # npm resolves peer dependencies more strictly than pnpm, and this tree was
    # resolved by pnpm. One retry rather than a failed deployment.
    if ($Pm.Exe -eq "npm") {
        Write-Host "  npm install failed; retrying with --legacy-peer-deps" -ForegroundColor Yellow
        & npm install --legacy-peer-deps
        if ($LASTEXITCODE -eq 0) { return }
    }

    throw "Installing the $What's dependencies failed."
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
Write-Host "  using $($apiPm.Name)"
Push-Location $BackendDir
try {
    Invoke-Install -Pm $apiPm -Dir $BackendDir -What "API"
    Invoke-Pm -Pm $apiPm -Arguments @("run", "build")
    if ($LASTEXITCODE -ne 0) { throw "API build failed" }
    Invoke-Pm -Pm $apiPm -Arguments @("run", "migrate")
    if ($LASTEXITCODE -ne 0) { throw "Database migration failed" }
} finally {
    Pop-Location
}

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
Write-Host "  using $($appPm.Name)"
Push-Location $AppDir
try {
    # A dev server writes its own route types under .next\dev and leaves them
    # half-written if it is ever killed — which then fails the production type
    # check, because tsconfig includes them. They are dev-only output.
    $devOutput = Join-Path $AppDir ".next\dev"
    if (Test-Path $devOutput) {
        Remove-Item $devOutput -Recurse -Force
        Write-Host "  cleared stale dev output"
    }

    Invoke-Install -Pm $appPm -Dir $AppDir -What "platform"
    Invoke-Pm -Pm $appPm -Arguments @("run", "build")
    if ($LASTEXITCODE -ne 0) { throw "Platform build failed" }
} finally {
    Pop-Location
}

Write-Host "`nBuilt. Start or restart the services with deploy\install.ps1 or deploy\update.ps1.`n" -ForegroundColor Green
