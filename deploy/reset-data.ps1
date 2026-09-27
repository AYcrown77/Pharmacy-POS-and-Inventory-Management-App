<#
    Hands the pharmacy an empty system. Right-click PowerShell -> Run as
    Administrator, then:

        powershell -ExecutionPolicy Bypass -File .\deploy\reset-data.ps1

    Everything entered while the platform was being built and tested goes:
    products, stock, customers, sales, debts, expenses, movements and the audit
    log. What stays is what the shop needs to sign in on day one - the
    administrator account(s), the terminals, and the pharmacy's own settings.

    A full backup is taken first and left in deploy\backups, so a reset done by
    mistake can be undone with restore-db.ps1.
#>
#Requires -RunAsAdministrator
param(
    [string]$BackendDir,
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    # Kept because the shop cannot sign in, pick a till or print a receipt
    # without them. Everything else in the database goes.
    [string[]]$KeepTables = @("users", "terminals", "settings", "schema_migrations"),
    # Accounts kept. The staff the shop actually employs are created afterwards,
    # in the app, by the administrator.
    [string]$KeepRole = "ADMINISTRATOR",
    # Skips the typed confirmation. For a rebuild nobody is watching.
    [switch]$Force
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

$BackendDir = Resolve-BackendDir -Hint $BackendDir -AppDir (Split-Path $PSScriptRoot -Parent)
$settings = Read-EnvSettings -BackendDir $BackendDir
$pgDump = Get-PgTool -Name "pg_dump"
$psql = Get-PgTool -Name "psql"
$database = $settings["DB_NAME"]

function Invoke-Sql {
    param([string]$Sql, [switch]$Stop)
    $arguments = @("-t", "-A", "-c", $Sql)
    if ($Stop) { $arguments = @("-v", "ON_ERROR_STOP=1") + $arguments }
    return Invoke-PgTool -Exe $psql -Settings $settings -Database $database -Arguments $arguments
}

# --------------------------------------------------------- what is in there
# Read from the database itself rather than a list written here, so a table
# added later is emptied too instead of quietly surviving a "factory reset".
$keepList = ($KeepTables | ForEach-Object { "'$_'" }) -join ", "
$tables = @(Invoke-Sql -Stop -Sql @"
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT IN ($keepList)
ORDER BY table_name
"@) | Where-Object { $_ }

Write-Host "`n== About to empty '$database'" -ForegroundColor Cyan
foreach ($table in @("products", "batches", "sales", "customers", "expenses")) {
    if ($tables -contains $table) {
        $rows = (Invoke-Sql -Sql "SELECT count(*) FROM $table" | Select-Object -Last 1)
        Write-Host ("  {0,-12} {1} rows -> 0" -f $table, $rows)
    }
}
Write-Host ("  and {0} tables in all: {1}" -f $tables.Count, ($tables -join ", ")) -ForegroundColor DarkGray

Write-Host "`n== Staying" -ForegroundColor Cyan
Write-Host ("  {0}" -f ($KeepTables -join ", "))
$keptUsers = @(Invoke-Sql -Sql "SELECT name || ' (' || username || ')' FROM users WHERE role = '$KeepRole' ORDER BY name" | Where-Object { $_ })
$goneUsers = @(Invoke-Sql -Sql "SELECT name || ' (' || username || ')' FROM users WHERE role <> '$KeepRole' ORDER BY name" | Where-Object { $_ })
foreach ($user in $keptUsers) { Write-Host "  keeping account: $user" -ForegroundColor Green }
foreach ($user in $goneUsers) { Write-Host "  deleting account: $user" -ForegroundColor Yellow }
if ($keptUsers.Count -eq 0) {
    throw "No $KeepRole account exists - emptying now would lock everyone out. Create one first."
}

Write-Host "`nThis cannot be undone except from the backup taken next." -ForegroundColor Yellow
if (-not $Force) {
    $typed = Read-Host "Type ERASE to go ahead (anything else cancels)"
    if ($typed -ne "ERASE") { Write-Host "Cancelled. Nothing was changed.`n"; exit 0 }
}

# ------------------------------------------------------------ safety first
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$safety = Join-Path $OutDir ("pre-reset-{0}-{1}.dump" -f $database, (Get-Date -Format "yyyy-MM-dd_HHmm"))
Write-Host "`ntaking a full backup first..."
Invoke-PgTool -Exe $pgDump -Settings $settings -Arguments @("-Fc", "-f", $safety, $database) | Out-Null
Write-Host ("  saved to {0} ({1:N1} MB)" -f $safety, ((Get-Item $safety).Length / 1MB)) -ForegroundColor Green

# ------------------------------------------------- stop, empty, start again
$apiTask = "Mustan Pharmacy API"
$stopped = $false
if (Get-ScheduledTask -TaskName $apiTask -ErrorAction SilentlyContinue) {
    Write-Host "`nstopping the platform so nothing is written while it empties..."
    Stop-ScheduledTask -TaskName $apiTask -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $stopped = $true
}

try {
    # One TRUNCATE for all of them: CASCADE and a single statement mean the
    # foreign keys between sales, items, batches and movements never come up.
    $list = ($tables | ForEach-Object { """$_""" }) -join ", "
    Write-Host "emptying..."
    Invoke-Sql -Stop -Sql "TRUNCATE TABLE $list RESTART IDENTITY CASCADE" | Out-Null

    Invoke-Sql -Stop -Sql "DELETE FROM users WHERE role <> '$KeepRole'" | Out-Null

    # The shop's first sale should read MHP-000001, not carry on from the
    # numbering of everything sold while testing.
    Invoke-Sql -Stop -Sql "ALTER SEQUENCE IF EXISTS receipt_number_seq RESTART WITH 1" | Out-Null
} finally {
    if ($stopped) {
        Write-Host "starting the platform again..."
        Start-ScheduledTask -TaskName $apiTask
    }
}

# ---------------------------------------------------------------- the state
Write-Host "`n== Now" -ForegroundColor Green
foreach ($table in @("products", "categories", "batches", "sales", "customers", "expenses", "audit_logs", "users", "terminals")) {
    $exists = Invoke-Sql -Sql "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='$table'" | Select-Object -Last 1
    if ([int]$exists -eq 0) { continue }
    $rows = (Invoke-Sql -Sql "SELECT count(*) FROM $table" | Select-Object -Last 1)
    Write-Host ("  {0,-12} {1}" -f $table, $rows)
}

Write-Host "`nNext, in the app:" -ForegroundColor Cyan
Write-Host "  1. sign in as the administrator and change that password"
Write-Host "  2. create an account for each member of staff"
Write-Host "  3. put the pharmacy's name, address and phone in Settings (they print on receipts)"
Write-Host "  4. add the products, then receive the real stock"
Write-Host ("`nThe data from before this reset is in {0}" -f $safety)
Write-Host "Keep that file somewhere safe until the shop has been trading for a few days.`n"
