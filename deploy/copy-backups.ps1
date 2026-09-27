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
Write-Host ""
Write-Host ("Copied {0} new backup(s); {1} were already there." -f $copied, $skipped) -ForegroundColor Green
Write-Host ("The stick now holds {0} backups ({1:N0} MB), newest {2}." -f $onStick.Count, ($size / 1MB), ($onStick | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime)
Write-Host "Eject the stick and keep it away from the shop.`n"
