<#
    Put a backup back. Right-click PowerShell -> Run as Administrator, then:

        powershell -ExecutionPolicy Bypass -File .\deploy\restore-db.ps1

    With no file named it offers the newest backup. Point -File at one on a USB
    stick when the PC itself has been replaced.

    This replaces everything in the database with what was in the backup, so
    anything sold since that backup was taken is gone. It therefore:
      - checks the backup is readable before touching anything;
      - takes a fresh "pre-restore" dump of what is there now, so a restore
        started by mistake can itself be undone;
      - stops the platform while it works, then starts it again.
#>
#Requires -RunAsAdministrator
param(
    [string]$BackendDir,
    [string]$File,
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    # Skips the typed confirmation. For unattended rebuilds only.
    [switch]$Force
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$BackendDir = Resolve-BackendDir -Hint $BackendDir -AppDir (Split-Path $PSScriptRoot -Parent)
$settings = Read-EnvSettings -BackendDir $BackendDir
$pgDump = Get-PgTool -Name "pg_dump"
$pgRestore = Get-PgTool -Name "pg_restore"
$psql = Get-PgTool -Name "psql"

if (-not $File) {
    $newest = Get-ChildItem $OutDir -Filter "*.dump" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "pre-restore-*" } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) { throw "No backups found in $OutDir. Name one with -File." }
    $File = $newest.FullName
}
if (-not (Test-Path $File)) { throw "No such file: $File" }
$backup = Get-Item $File

Write-Host "`nAbout to restore:" -ForegroundColor Cyan
Write-Host ("  backup   {0}" -f $backup.FullName)
Write-Host ("  taken    {0} ({1})" -f $backup.LastWriteTime, (Format-Age $backup.LastWriteTime))
Write-Host ("  into     database '{0}' on {1}" -f $settings["DB_NAME"], $settings["DB_HOST"])
Write-Host "`nEverything recorded since that time will be lost." -ForegroundColor Yellow

# Readable before anything is destroyed: finding out the file is corrupt after
# wiping the live database is the one outcome to design against.
Invoke-PgTool -Exe $pgRestore -Settings $settings -Arguments @("-l", $backup.FullName) | Out-Null
Write-Host "the backup file reads correctly."

if (-not $Force) {
    $typed = Read-Host "`nType RESTORE to go ahead (anything else cancels)"
    if ($typed -ne "RESTORE") { Write-Host "Cancelled. Nothing was changed.`n"; exit 0 }
}

# ------------------------------------------------- safety copy of right now
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$safety = Join-Path $OutDir ("pre-restore-{0}-{1}.dump" -f $settings["DB_NAME"], (Get-Date -Format "yyyy-MM-dd_HHmm"))
Write-Host "`ntaking a copy of the current data first..."
try {
    Invoke-PgTool -Exe $pgDump -Settings $settings -Arguments @("-Fc", "-f", $safety, $settings["DB_NAME"]) | Out-Null
    Write-Host ("  saved to {0}" -f $safety)
} catch {
    # An empty or unreachable database has nothing worth saving; anything else
    # is a reason to stop.
    Write-Host ("  could not copy the current data: {0}" -f $_.Exception.Message) -ForegroundColor Yellow
    if (-not $Force) {
        $typed = Read-Host "  Continue without that safety copy? Type YES"
        if ($typed -ne "YES") { Write-Host "Cancelled. Nothing was changed.`n"; exit 0 }
    }
}

# ---------------------------------------------------------- stop, restore, start
$apiTask = "Mustan Pharmacy API"
$stopped = $false
if (Get-ScheduledTask -TaskName $apiTask -ErrorAction SilentlyContinue) {
    Write-Host "`nstopping the platform..."
    Stop-ScheduledTask -TaskName $apiTask -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $stopped = $true
}

try {
    # Other connections hold locks the restore would trip over halfway through.
    $kill = "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '{0}' AND pid <> pg_backend_pid()" -f $settings["DB_NAME"]
    Invoke-PgTool -Exe $psql -Settings $settings -Database "postgres" -Arguments @("-t", "-A", "-c", $kill) | Out-Null

    # An empty database first, so what comes out is the backup and nothing
    # else. Restoring over the top would leave behind anything created since
    # the backup was taken - a table from a newer version of the app, say,
    # still holding the data from today that this restore is meant to undo.
    $recreated = $false
    try {
        Invoke-PgTool -Exe $psql -Settings $settings -Database "postgres" `
            -Arguments @("-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", ("DROP DATABASE IF EXISTS {0}" -f $settings["DB_NAME"])) | Out-Null
        Invoke-PgTool -Exe $psql -Settings $settings -Database "postgres" `
            -Arguments @("-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", ("CREATE DATABASE {0} OWNER ""{1}""" -f $settings["DB_NAME"], $settings["DB_USER"])) | Out-Null
        $recreated = $true
    } catch {
        # Some installations do not let this account create databases. Restoring
        # over the existing one is second best but still puts the data back.
        Write-Host ("  could not recreate the database ({0})" -f $_.Exception.Message) -ForegroundColor Yellow
        Write-Host "  restoring over the existing one instead" -ForegroundColor Yellow
    }

    Write-Host "restoring..."
    $restoreArguments = @("--no-owner", "--no-privileges")
    if (-not $recreated) { $restoreArguments += @("--clean", "--if-exists") }
    $restoreArguments += $backup.FullName
    Invoke-PgTool -Exe $pgRestore -Settings $settings -Database $settings["DB_NAME"] -Arguments $restoreArguments | Out-Null
} finally {
    if ($stopped) {
        Write-Host "starting the platform again..."
        Start-ScheduledTask -TaskName $apiTask
    }
}

Write-Host "`nRestored. What is in the database now:" -ForegroundColor Green
foreach ($table in "sales", "products", "customers", "users") {
    $rows = Invoke-PgTool -Exe $psql -Settings $settings -Database $settings["DB_NAME"] `
        -Arguments @("-t", "-A", "-c", "SELECT count(*) FROM $table")
    Write-Host ("  {0,-12} {1}" -f $table, (($rows | Select-Object -Last 1) -as [string]).Trim())
}
Write-Host "`nOpen the platform and check today's sales look right."
Write-Host "If this backup predates an update, run build.ps1 as well - it brings the"
Write-Host "database up to date with the current version of the app."
Write-Host ("If this was a mistake, the data from just before is in {0}`n" -f $safety)
