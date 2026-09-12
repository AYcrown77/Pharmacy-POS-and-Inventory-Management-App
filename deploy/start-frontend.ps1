<#
    Runs the platform the tills open. Started by the "Mustan Pharmacy POS" task
    at boot.

    This serves the production build, not `npm run dev`: it starts in a
    second, serves far faster on the counter PCs, and has none of the
    development server's restrictions on which machines may connect.
#>
param(
    [int]$Port = 80,
    [string]$AppDir = (Split-Path $PSScriptRoot -Parent)
)

$ErrorActionPreference = "Stop"
$AppDir = (Resolve-Path $AppDir).Path
$next = Join-Path $AppDir "node_modules\next\dist\bin\next"

if (-not (Test-Path (Join-Path $AppDir ".next\BUILD_ID"))) {
    throw "No production build in $AppDir. Run deploy\build.ps1 first."
}

$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Get-ChildItem -Path $logDir -Filter "pos-*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$out = Join-Path $logDir "pos-$stamp.log"
$err = Join-Path $logDir "pos-$stamp.err.log"

$env:NODE_ENV = "production"

$node = (Get-Command node).Source
# -H 0.0.0.0 binds every network card, so the tills can reach it — not just
# this PC. Next's own entry point is run directly: no npm wrapper process
# between the service and the server it is supposed to be watching.
$process = Start-Process -FilePath $node `
    -ArgumentList @("`"$next`"", "start", "-p", "$Port", "-H", "0.0.0.0") `
    -WorkingDirectory $AppDir -NoNewWindow -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err
$process.WaitForExit()
exit $process.ExitCode
