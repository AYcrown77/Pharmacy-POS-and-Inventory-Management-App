<#
    Runs the pharmacy API. Started by the "Mustan Pharmacy API" task at boot.

    Everything else it needs — database credentials, port — comes from
    mutaan-backend\.env, so this sets only what the service itself decides.
#>
param(
    [string]$BackendDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\mutaan-backend")
)

$ErrorActionPreference = "Stop"
$BackendDir = (Resolve-Path $BackendDir).Path

$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Get-ChildItem -Path $logDir -Filter "api-*.log" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force -ErrorAction SilentlyContinue

$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$out = Join-Path $logDir "api-$stamp.log"
$err = Join-Path $logDir "api-$stamp.err.log"

$env:NODE_ENV = "production"

# Start-Process rather than calling node directly: PowerShell 5.1 turns a
# native command's stderr into error records, which with a strict error
# preference would kill the service on the first warning node prints.
$node = (Get-Command node).Source
$process = Start-Process -FilePath $node -ArgumentList "dist\index.js" `
    -WorkingDirectory $BackendDir -NoNewWindow -PassThru `
    -RedirectStandardOutput $out -RedirectStandardError $err
$process.WaitForExit()
exit $process.ExitCode
