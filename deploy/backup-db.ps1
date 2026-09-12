<#
    Nightly database backup. Installed by install.ps1 to run at 10pm.

    The password is read from the API's .env and handed to pg_dump through the
    environment — it is never written to a file or printed.
#>
param(
    [string]$BackendDir = (Join-Path (Split-Path $PSScriptRoot -Parent) "..\mutaan-backend"),
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    [int]$KeepDays = 30
)

$ErrorActionPreference = "Stop"
$BackendDir = (Resolve-Path $BackendDir).Path
$envFile = Join-Path $BackendDir ".env"
if (-not (Test-Path $envFile)) { throw "$envFile is missing." }

$settings = @{}
foreach ($line in Get-Content $envFile) {
    if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$") {
        $settings[$Matches[1]] = $Matches[2].Trim()
    }
}

$pgDump = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\pg_dump.exe" -ErrorAction SilentlyContinue |
    Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw "pg_dump.exe not found under C:\Program Files\PostgreSQL." }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$file = Join-Path $OutDir ("{0}-{1}.dump" -f $settings["DB_NAME"], (Get-Date -Format "yyyy-MM-dd_HHmm"))

$env:PGPASSWORD = $settings["DB_PASSWORD"]
try {
    & $pgDump.FullName -U $settings["DB_USER"] -h $settings["DB_HOST"] -p $settings["DB_PORT"] `
        -Fc -f $file $settings["DB_NAME"]
    if ($LASTEXITCODE -ne 0) { throw "pg_dump exited with $LASTEXITCODE" }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Get-ChildItem $OutDir -Filter "*.dump" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force

$size = "{0:N1} MB" -f ((Get-Item $file).Length / 1MB)
Write-Host "backed up to $file ($size)"
