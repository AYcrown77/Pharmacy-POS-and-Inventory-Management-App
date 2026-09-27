<#
    Database backup. install.ps1 runs this every hour through the trading day;
    it is also safe to run by hand at any moment - it never interrupts a sale.

    In order, it:
      1. dumps the whole database to a new file;
      2. checks the file really is a readable backup before trusting it;
      3. copies it to every mirror given with -MirrorTo (a USB stick left in
         the PC, a shared folder on another laptop);
      4. thins old backups: every one from the last few days, then one a day
         for a month, then one a month for a year;
      5. writes what happened to backups\backup-status.json, which
         check-backups.ps1 and status.ps1 read out in plain English.

    The password is read from the API's .env and handed to pg_dump through the
    environment - it is never written to a file or printed.
#>
param(
    [string]$BackendDir,
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    # A backup that only exists on the PC it came from is not a backup: that PC
    # is exactly what fails. Unreachable mirrors are reported, never fatal - a
    # stick somebody pulled out must not stop the backup itself.
    #
    # Several destinations: "E:\MustanBackups;D:\Backups" from a scheduled task,
    # or a normal PowerShell list when typed by hand.
    [string[]]$MirrorTo = @(),
    [int]$KeepAllDays = 3,
    [int]$KeepDailyDays = 30,
    [int]$KeepMonthlyMonths = 12
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

# A scheduled task hands over one string holding every destination; typed by
# hand it is already a list. Either way it ends up as clean paths here.
$mirrors = @($MirrorTo |
    Where-Object { $_ } |
    ForEach-Object { $_ -split ";" } |
    ForEach-Object { $_.Trim().TrimEnd("\") } |
    Where-Object { $_ })

$BackendDir = Resolve-BackendDir -Hint $BackendDir -AppDir (Split-Path $PSScriptRoot -Parent)
$settings = Read-EnvSettings -BackendDir $BackendDir
$pgDump = Get-PgTool -Name "pg_dump"
$pgRestore = Get-PgTool -Name "pg_restore"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$status = Read-BackupStatus -OutDir $OutDir
$started = Get-Date
$status = Set-StatusValue -Status $status -Name "lastRunAt" -Value $started.ToString("s")

$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "backup.log"
function Write-Log {
    param([string]$Message)
    "{0}  {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message | Add-Content -Path $logFile -Encoding utf8
    Write-Host $Message
}

$name = "{0}-{1}.dump" -f $settings["DB_NAME"], $started.ToString("yyyy-MM-dd_HHmm")
$file = Join-Path $OutDir $name
# Written under a temporary name first: a half-finished file must never sit in
# the folder looking like a good backup.
$partial = "$file.partial"

try {
    Invoke-PgTool -Exe $pgDump -Settings $settings -Arguments @("-Fc", "-f", $partial, $settings["DB_NAME"]) | Out-Null

    if (-not (Test-Path $partial) -or (Get-Item $partial).Length -lt 1024) {
        throw "pg_dump produced an empty file."
    }
    # Reading the table of contents back proves the file is a complete dump and
    # not a truncated one. Cheap, and it is the difference between having a
    # backup and believing you have one.
    Invoke-PgTool -Exe $pgRestore -Settings $settings -Arguments @("-l", $partial) | Out-Null

    Move-Item -Path $partial -Destination $file -Force
    $size = (Get-Item $file).Length

    $status = Set-StatusValue -Status $status -Name "lastSuccessAt" -Value (Get-Date).ToString("s")
    $status = Set-StatusValue -Status $status -Name "lastFile" -Value $file
    $status = Set-StatusValue -Status $status -Name "lastSizeBytes" -Value $size
    $status = Set-StatusValue -Status $status -Name "lastError" -Value $null
    Write-Log ("backed up to {0} ({1:N1} MB, {2:N0}s)" -f $file, ($size / 1MB), ((Get-Date) - $started).TotalSeconds)
} catch {
    Remove-Item $partial -Force -ErrorAction SilentlyContinue
    $status = Set-StatusValue -Status $status -Name "lastError" -Value $_.Exception.Message
    Save-BackupStatus -OutDir $OutDir -Status $status
    Write-Log ("BACKUP FAILED: {0}" -f $_.Exception.Message)
    throw
}

# ---------------------------------------------------------------- mirrors
$mirrorStatus = @{}
foreach ($mirror in $mirrors) {
    $entry = @{ path = $mirror; ok = $false; lastCopiedAt = $null; error = $null }
    try {
        New-Item -ItemType Directory -Force -Path $mirror | Out-Null
        $copy = Join-Path $mirror $name
        Copy-Item -Path $file -Destination $copy -Force
        if ((Get-Item $copy).Length -ne (Get-Item $file).Length) { throw "the copy is a different size to the original." }

        Remove-OldBackups -Dir $mirror -AllDays $KeepAllDays -DailyDays $KeepDailyDays -MonthlyMonths $KeepMonthlyMonths | Out-Null
        $entry.ok = $true
        $entry.lastCopiedAt = (Get-Date).ToString("s")
        Write-Log ("copied to {0}" -f $mirror)
    } catch {
        $entry.error = $_.Exception.Message
        # Deliberately not fatal, but loud in the health check until it is fixed.
        Write-Log ("MIRROR UNREACHABLE {0}: {1}" -f $mirror, $_.Exception.Message)
    }
    $mirrorStatus[$mirror] = $entry
}
if ($mirrors.Count -gt 0) {
    $status = Set-StatusValue -Status $status -Name "mirrors" -Value $mirrorStatus
}

# ---------------------------------------------------------------- tidying
$removed = Remove-OldBackups -Dir $OutDir -AllDays $KeepAllDays -DailyDays $KeepDailyDays -MonthlyMonths $KeepMonthlyMonths
if ($removed -gt 0) { Write-Log ("removed {0} older backup(s) no longer on the schedule" -f $removed) }

$kept = @(Get-ChildItem $OutDir -Filter "*.dump" -ErrorAction SilentlyContinue)
$oldest = $null
if ($kept.Count -gt 0) {
    $oldest = ($kept | Sort-Object LastWriteTime | Select-Object -First 1).LastWriteTime.ToString("s")
}
$status = Set-StatusValue -Status $status -Name "backupCount" -Value $kept.Count
$status = Set-StatusValue -Status $status -Name "oldestBackupAt" -Value $oldest
Save-BackupStatus -OutDir $OutDir -Status $status

# The log is a tail, not an archive.
$lines = Get-Content $logFile -ErrorAction SilentlyContinue
if ($lines.Count -gt 2000) { $lines | Select-Object -Last 1000 | Set-Content -Path $logFile -Encoding utf8 }
