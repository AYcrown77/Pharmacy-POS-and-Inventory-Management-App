<#
    Copy the backups onto a stick to take away from the shop.

        powershell -ExecutionPolicy Bypass -File .\deploy\copy-backups.ps1

    install.ps1 puts this on the desktop as "Copy Mustan backups to USB", so it
    is a double-click and nothing to type. Plug the stick in first; with no
    drive named, it finds the removable drive itself.

    Why bother when a stick already lives in the PC: fire, theft and flood take
    the PC and everything plugged into it. This copy leaves the building.
#>
param(
    # e.g. -To E:\  - omit it when exactly one removable drive is plugged in.
    [string]$To,
    [string]$OutDir = (Join-Path $PSScriptRoot "backups"),
    # One a day for a month is plenty to carry around.
    [int]$Days = 35,
    [string]$FolderName = "MustanBackups"
)

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "common.ps1")

if (-not $To) {
    $removable = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2")
    if ($removable.Count -eq 0) {
        Write-Host "`nNo USB drive found. Plug the stick in and run this again.`n" -ForegroundColor Yellow
        exit 1
    }
    if ($removable.Count -gt 1) {
        Write-Host "`nMore than one USB drive is plugged in:" -ForegroundColor Yellow
        $removable | ForEach-Object { Write-Host ("  {0}  {1}" -f $_.DeviceID, $_.VolumeName) }
        Write-Host "Run again naming one, for example: -To $($removable[0].DeviceID)\`n"
        exit 1
    }
    $To = "$($removable[0].DeviceID)\"
    Write-Host "using $To ($($removable[0].VolumeName))"
}

$target = Join-Path $To $FolderName
New-Item -ItemType Directory -Force -Path $target | Out-Null

$since = (Get-Date).AddDays(-$Days)
$files = @(Get-ChildItem $OutDir -Filter "*.dump" -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -ge $since } | Sort-Object LastWriteTime)
if ($files.Count -eq 0) { throw "No backups from the last $Days days in $OutDir." }

$copied = 0
$skipped = 0
foreach ($file in $files) {
    $destination = Join-Path $target $file.Name
    # Already there and the same size: nothing to do. Makes it safe to run as
    # often as anyone likes, and quick on a slow stick.
    if ((Test-Path $destination) -and (Get-Item $destination).Length -eq $file.Length) { $skipped++; continue }
    Copy-Item -Path $file.FullName -Destination $destination -Force
    if ((Get-Item $destination).Length -ne $file.Length) { throw "$($file.Name) did not copy fully - is the stick full?" }
    $copied++
}

$onStick = @(Get-ChildItem $target -Filter "*.dump")
$size = ($onStick | Measure-Object -Property Length -Sum).Sum

# Recorded where check-backups.ps1 reads it, so "is there a copy off this PC?"
# has an answer whether that copy goes to a stick or to a folder that syncs.
$status = Read-BackupStatus -OutDir $OutDir
$status = Set-StatusValue -Status $status -Name "offsite" -Value @{
    target = $target
    lastCopiedAt = (Get-Date).ToString("s")
    backupCount = $onStick.Count
}
Save-BackupStatus -OutDir $OutDir -Status $status
# The same script serves the stick somebody carries home and the folder that
# syncs itself every evening, so the closing line has to match which one it is.
$root = [System.IO.Path]::GetPathRoot($target)
$isStick = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType = 2" |
    Where-Object { $root -like "$($_.DeviceID)*" }).Count -gt 0

$summary = "copied {0} new backup(s), {1} already there; {2} now holds {3} backups ({4:N0} MB)" -f `
    $copied, $skipped, $target, $onStick.Count, ($size / 1MB)
"{0}  offsite: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $summary |
    Add-Content -Path (Join-Path $PSScriptRoot "logs\backup.log") -Encoding utf8

Write-Host ""
Write-Host ("Copied {0} new backup(s); {1} were already there." -f $copied, $skipped) -ForegroundColor Green
Write-Host ("{0} now holds {1} backups ({2:N0} MB), newest {3}." -f $target, $onStick.Count, ($size / 1MB), ($onStick | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime)
if ($isStick) { Write-Host "Eject the stick and keep it away from the shop.`n" }
else { Write-Host "That folder syncs itself off this PC - leave the PC signed in so it can.`n" }
