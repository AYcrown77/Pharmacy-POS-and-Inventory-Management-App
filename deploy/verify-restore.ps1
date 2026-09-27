<#
    Weekly proof that the backups can actually be restored.

    A backup nobody has ever restored is a guess. Once a week this takes the
    newest backup, loads it into a scratch database, counts the rows, and
    throws the scratch database away. The shop's real database is only ever
    read from - never touched.

    The result goes into backups\backup-status.json, so check-backups.ps1 can
    say "last proved restorable on ..." instead of "a file exists".
#>
param(
    [string]$BackendDir,
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    [string]$File,
    # Deliberately not the live database name, and dropped again at the end.
    [string]$ScratchDb = "mustan_restore_check"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$BackendDir = Resolve-BackendDir -Hint $BackendDir -AppDir (Split-Path $PSScriptRoot -Parent)
$settings = Read-EnvSettings -BackendDir $BackendDir
if ($ScratchDb -eq $settings["DB_NAME"]) { throw "The scratch database must not be the live one." }
$pgRestore = Get-PgTool -Name "pg_restore"
$psql = Get-PgTool -Name "psql"

if (-not $File) {
    $newest = Get-ChildItem $OutDir -Filter "*.dump" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "pre-restore-*" } |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $newest) { throw "No backups found in $OutDir." }
    $File = $newest.FullName
}
Write-Host "checking $File"

$status = Read-BackupStatus -OutDir $OutDir
$drill = @{ lastRunAt = (Get-Date).ToString("s"); ok = $false; file = $File; detail = $null }

# "postgres" is the maintenance database every server has: the scratch database
# cannot be created from inside itself.
function Invoke-Maintenance {
    param([string]$Sql)
    Invoke-PgTool -Exe $psql -Settings $settings -Database "postgres" -Arguments @("-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", $Sql)
}

try {
    Invoke-Maintenance -Sql "DROP DATABASE IF EXISTS $ScratchDb" | Out-Null
    Invoke-Maintenance -Sql "CREATE DATABASE $ScratchDb" | Out-Null

    # --no-owner/--no-privileges: the scratch database only needs the data, and
    # a missing role on a spare copy is not a reason to call a backup bad.
    Invoke-PgTool -Exe $pgRestore -Settings $settings -Database $ScratchDb `
        -Arguments @("--no-owner", "--no-privileges", "--exit-on-error", $File) | Out-Null

    $counts = @{}
    foreach ($table in "sales", "sale_items", "products", "customers", "users") {
        $rows = Invoke-PgTool -Exe $psql -Settings $settings -Database $ScratchDb `
            -Arguments @("-v", "ON_ERROR_STOP=1", "-t", "-A", "-c", "SELECT count(*) FROM $table")
        $counts[$table] = [int](($rows | Select-Object -Last 1) -as [string]).Trim()
    }

    # A restore that "succeeds" into an empty database is the failure worth
    # catching: every shop has products and users from day one.
    if ($counts["products"] -lt 1 -or $counts["users"] -lt 1) {
        throw "restored, but products/users came back empty - the backup is not usable."
    }

    $drill.ok = $true
    $drill.detail = (($counts.Keys | Sort-Object | ForEach-Object { "$_=$($counts[$_])" }) -join ", ")
    Write-Host "  restore works: $($drill.detail)" -ForegroundColor Green
} catch {
    $drill.detail = $_.Exception.Message
    Write-Host "  RESTORE CHECK FAILED: $($drill.detail)" -ForegroundColor Red
} finally {
    try { Invoke-Maintenance -Sql "DROP DATABASE IF EXISTS $ScratchDb" | Out-Null } catch { }
    $status = Set-StatusValue -Status $status -Name "drill" -Value $drill
    Save-BackupStatus -OutDir $OutDir -Status $status

    $line = "{0}  restore check: {1} ({2})" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $(if ($drill.ok) { "ok" } else { "FAILED" }), $drill.detail
    $line | Add-Content -Path (Join-Path $PSScriptRoot "logs\backup.log") -Encoding utf8
}

if (-not $drill.ok) { exit 1 }
