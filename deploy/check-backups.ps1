<#
    Are the backups healthy? Run any time - no Administrator needed.

        powershell -ExecutionPolicy Bypass -File .\deploy\check-backups.ps1

    Answers the only three questions that matter: when did the last good backup
    run, is there a copy somewhere other than this PC, and has a backup been
    proved restorable lately.
#>
param(
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    # A day's trading is the most anyone should be willing to lose.
    [int]$MaxAgeHours = 24,
    [int]$MaxDrillDays = 14
)

$ErrorActionPreference = "Continue"
. (Join-Path $PSScriptRoot "common.ps1")

$problems = @()
Write-Host "`n== Backups" -ForegroundColor Cyan

if (-not (Test-Path (Get-BackupStatusPath -OutDir $OutDir))) {
    Write-Host "  no backup has ever run on this PC" -ForegroundColor Red
    Write-Host "  fix: run install.ps1 as Administrator, or .\deploy\backup-db.ps1 to take one now`n"
    exit 1
}

$status = Read-BackupStatus -OutDir $OutDir

$age = if ($status.lastSuccessAt) { (Get-Date) - [datetime]$status.lastSuccessAt } else { $null }
$size = if ($status.lastSizeBytes) { "{0:N1} MB" -f ($status.lastSizeBytes / 1MB) } else { "unknown size" }
if (-not $age) {
    Write-Host "  last good backup: never" -ForegroundColor Red
    $problems += "no backup has ever completed"
} elseif ($age.TotalHours -gt $MaxAgeHours) {
    Write-Host ("  last good backup: {0} ({1}) - TOO OLD" -f (Format-Age $status.lastSuccessAt), $size) -ForegroundColor Red
    $problems += "the newest backup is $([int]$age.TotalHours) hours old"
} else {
    Write-Host ("  last good backup: {0} ({1})" -f (Format-Age $status.lastSuccessAt), $size) -ForegroundColor Green
}

if ($status.lastError) {
    Write-Host ("  last attempt ended with: {0}" -f $status.lastError) -ForegroundColor Red
    $problems += "the last backup attempt failed"
}

if ($status.backupCount) {
    Write-Host ("  kept on this PC: {0} backups, oldest {1}" -f $status.backupCount, (Format-Age $status.oldestBackupAt))
}

Write-Host "`n== Copies off this PC" -ForegroundColor Cyan
$mirrors = @()
if ($status.mirrors) { $mirrors = @($status.mirrors.PSObject.Properties) }
if ($mirrors.Count -eq 0) {
    Write-Host "  none set up - every copy is on this one PC" -ForegroundColor Red
    Write-Host "  fix: leave a USB stick in the PC and re-run install.ps1 with -MirrorTo E:\MustanBackups"
    $problems += "there is no copy off this PC"
} else {
    foreach ($mirror in $mirrors) {
        $entry = $mirror.Value
        if ($entry.ok) {
            Write-Host ("  {0}  copied {1}" -f $entry.path, (Format-Age $entry.lastCopiedAt)) -ForegroundColor Green
        } else {
            Write-Host ("  {0}  NOT WORKING: {1}" -f $entry.path, $entry.error) -ForegroundColor Red
            Write-Host "  fix: is the USB stick still in the PC, or the other laptop on and shared?"
            $problems += "the copy to $($entry.path) is not working"
        }
    }
}

Write-Host "`n== Proved restorable" -ForegroundColor Cyan
if (-not $status.drill) {
    Write-Host "  never tested" -ForegroundColor Yellow
    Write-Host "  fix: .\deploy\verify-restore.ps1 tests it now (it never touches the live data)"
    $problems += "no backup has been test-restored yet"
} else {
    $drillAge = (Get-Date) - [datetime]$status.drill.lastRunAt
    if (-not $status.drill.ok) {
        Write-Host ("  last test {0}: FAILED - {1}" -f (Format-Age $status.drill.lastRunAt), $status.drill.detail) -ForegroundColor Red
        $problems += "the last test restore failed"
    } elseif ($drillAge.TotalDays -gt $MaxDrillDays) {
        Write-Host ("  last successful test: {0} - overdue" -f (Format-Age $status.drill.lastRunAt)) -ForegroundColor Yellow
        $problems += "the test restore is overdue"
    } else {
        Write-Host ("  last successful test: {0} ({1})" -f (Format-Age $status.drill.lastRunAt), $status.drill.detail) -ForegroundColor Green
    }
}

Write-Host ""
if ($problems.Count -eq 0) {
    Write-Host "All good. Backups are running, copied off this PC, and known to restore.`n" -ForegroundColor Green
    exit 0
}

Write-Host "Needs attention:" -ForegroundColor Red
foreach ($problem in $problems) { Write-Host "  - $problem" }
Write-Host ""
exit 1
