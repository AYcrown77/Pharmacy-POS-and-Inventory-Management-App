<#
    One-time setup on the shop's server PC. Right-click PowerShell -> Run as
    Administrator, then:

        powershell -ExecutionPolicy Bypass -File .\deploy\install.ps1

    Afterwards both apps start themselves whenever the PC is switched on - no
    terminal, no npm, nobody logged in - and restart on their own if they stop.
#>
#Requires -RunAsAdministrator
param(
    # Port 80 keeps the port out of the address the staff type: http://server/
    [int]$Port = 80,
    # Only needed when the API folder cannot be found automatically.
    [string]$BackendDir,
    [switch]$NoBackup,
    # Where every backup is copied as soon as it is taken - a USB stick left in
    # this PC (-MirrorTo E:\MustanBackups) or a shared folder on another
    # laptop. More than one is fine: -MirrorTo E:\MustanBackups, D:\Backups
    [string[]]$MirrorTo = @(),
    # A folder that syncs itself off this PC - a OneDrive or Google Drive
    # folder. One copy a day goes there, in the evening, which is a couple of
    # MB of data and puts a copy outside the building without anyone
    # remembering to do anything:
    #   -CloudFolder "C:\Users\musta\OneDrive"
    [string]$CloudFolder,
    # Backups run every hour between these two, and once more at the end of the
    # trading day. Losing an hour of sales is recoverable from the receipts;
    # losing a day is not.
    [int]$BackupFromHour = 7,
    [int]$BackupToHour = 23
)

$ErrorActionPreference = "Stop"
$apiTask = "Mustan Pharmacy API"
$posTask = "Mustan Pharmacy POS"
$backupTask = "Mustan Pharmacy Backup"
$checkTask = "Mustan Pharmacy Backup Check"
$cloudTask = "Mustan Pharmacy Backup Offsite"

# Installing over a platform that is already running is normal - it is how a
# new setting, a new port or a new backup schedule arrives. Stop ours first, so
# the port check below is about something else holding the port, not about us.
# Everything is started again at the end.
foreach ($name in $posTask, $apiTask) {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        Write-Host "stopping $name to re-install it"
    }
}
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match "bin.next.+start|dist.index.js" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2

$inUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.OwningProcess -ne 0 }
if ($inUse) {
    $owner = (Get-Process -Id $inUse[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
    throw "Port $Port is already used by '$owner'. Re-run with, for example, -Port 3000."
}

function Install-AppTask {
    param([string]$Name, [string]$Script, [string]$Arguments = "")

    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"{0}`" {1}" -f $Script, $Arguments).Trim()
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    # No time limit: these run all day. Restart on failure: if node stops for
    # any reason, Windows brings it back a minute later without anyone noticing.
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -RestartCount 99 -RestartInterval (New-TimeSpan -Minutes 1)

    Register-ScheduledTask -TaskName $Name -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Force | Out-Null
    Write-Host "  installed: $Name"
}

<#
    Builds one "-Name value" pair for a scheduled task's command line.

    Two traps, both silent: a path ending in a backslash escapes the closing
    quote and swallows whatever follows it, and a comma-separated list handed
    to powershell.exe -File arrives as a single string rather than a list. So
    trailing backslashes go, and several values travel separated by semicolons
    for the receiving script to split.
#>
function Format-ScriptArgument {
    param([string]$Name, [string[]]$Values)

    $clean = @($Values | Where-Object { $_ } | ForEach-Object { $_.Trim().TrimEnd("\") } | Where-Object { $_ })
    if ($clean.Count -eq 0) { return "" }
    return (" -{0} `"{1}`"" -f $Name, ($clean -join ";"))
}

Write-Host "`n== Services" -ForegroundColor Cyan
$apiArguments = (Format-ScriptArgument -Name "BackendDir" -Values $BackendDir).Trim()
Install-AppTask -Name $apiTask -Script (Join-Path $PSScriptRoot "start-backend.ps1") -Arguments $apiArguments
Install-AppTask -Name $posTask -Script (Join-Path $PSScriptRoot "start-frontend.ps1") -Arguments "-Port $Port"

if (-not $NoBackup) {
    Write-Host "`n== Backups" -ForegroundColor Cyan
    $backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    # StartWhenAvailable: a PC switched off at 1pm still takes the 1pm backup
    # when it comes back, instead of skipping that hour silently.
    $backupSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

    $mirrorArguments = Format-ScriptArgument -Name "MirrorTo" -Values $MirrorTo
    $backupAction = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"{0}`" {1}{2}" -f (Join-Path $PSScriptRoot "backup-db.ps1"), $apiArguments, $mirrorArguments).Trim()

    # Every hour through the trading day, not once at night: a laptop that dies
    # at 4pm should cost the shop an hour of sales, not the whole day.
    #
    # It has to be a *daily* trigger carrying an hourly repetition. A one-off
    # trigger with the same repetition runs for one day and then never again -
    # backups would stop the day after install, silently.
    $hours = [Math]::Max($BackupToHour - $BackupFromHour, 1)
    $startAt = [datetime]::Today.AddHours($BackupFromHour)
    $backupTrigger = New-ScheduledTaskTrigger -Daily -At $startAt
    $backupTrigger.Repetition = (New-ScheduledTaskTrigger -Once -At $startAt `
        -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Hours $hours)).Repetition
    Register-ScheduledTask -TaskName $backupTask -Action $backupAction -Trigger $backupTrigger `
        -Principal $backupPrincipal -Settings $backupSettings -Force | Out-Null
    Write-Host ("  installed: {0} (every hour, {1}:00 to {2}:00)" -f $backupTask, $BackupFromHour, $BackupToHour)

    if ($MirrorTo.Count -gt 0) {
        Write-Host ("  every backup is also copied to: {0}" -f ($MirrorTo -join ", "))
    } else {
        Write-Host "  WARNING: no second copy. Every backup will sit on this PC only." -ForegroundColor Yellow
        Write-Host "           Leave a USB stick in this PC and re-run with -MirrorTo E:\MustanBackups" -ForegroundColor Yellow
    }

    if ($CloudFolder) {
        # Once a day rather than hourly: the folder syncs over the shop's
        # internet, and an hourly upload would spend data all day for a copy
        # the USB stick already holds. The copy skips files already there, so
        # it is a couple of MB each evening.
        $cloudAction = New-ScheduledTaskAction -Execute "powershell.exe" `
            -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"{0}`"{1}" -f `
                (Join-Path $PSScriptRoot "copy-backups.ps1"), (Format-ScriptArgument -Name "To" -Values $CloudFolder))
        $cloudTrigger = New-ScheduledTaskTrigger -Daily -At "10:15pm"
        Register-ScheduledTask -TaskName $cloudTask -Action $cloudAction -Trigger $cloudTrigger `
            -Principal $backupPrincipal -Settings $backupSettings -Force | Out-Null
        Write-Host ("  installed: {0} (10:15pm, into {1}\MustanBackups)" -f $cloudTask, $CloudFolder.TrimEnd("\"))
        Write-Host "  that folder must be one that syncs by itself, and this PC left signed in"
    } elseif (Get-ScheduledTask -TaskName $cloudTask -ErrorAction SilentlyContinue) {
        Unregister-ScheduledTask -TaskName $cloudTask -Confirm:$false
        Write-Host "  removed: $cloudTask (no -CloudFolder given this time)"
    }

    # Weekly: proves the newest backup can actually be restored, into a scratch
    # database that is thrown away afterwards.
    $checkAction = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"{0}`" {1}" -f (Join-Path $PSScriptRoot "verify-restore.ps1"), $apiArguments).Trim()
    $checkTrigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At "11:30pm"
    Register-ScheduledTask -TaskName $checkTask -Action $checkAction -Trigger $checkTrigger `
        -Principal $backupPrincipal -Settings $backupSettings -Force | Out-Null
    Write-Host "  installed: $checkTask (Sundays at 11:30pm)"

    # One double-click for the weekly copy that leaves the building.
    try {
        $desktop = [Environment]::GetFolderPath("CommonDesktopDirectory")
        $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop "Copy Mustan backups to USB.lnk"))
        $shortcut.TargetPath = "powershell.exe"
        $shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -NoExit -File `"{0}`"" -f (Join-Path $PSScriptRoot "copy-backups.ps1")
        $shortcut.WorkingDirectory = Split-Path $PSScriptRoot -Parent
        $shortcut.Description = "Copy the pharmacy backups onto a USB stick to take home"
        $shortcut.Save()
        Write-Host "  desktop shortcut: Copy Mustan backups to USB"
    } catch {
        Write-Host "  (could not create the desktop shortcut: $($_.Exception.Message))" -ForegroundColor Yellow
    }

    # One now, so there is a backup before the shop opens rather than after the
    # first hour of trading.
    Write-Host "  taking a first backup now..."
    Start-ScheduledTask -TaskName $backupTask
}

Write-Host "`n== Firewall" -ForegroundColor Cyan
$ruleName = "Mustan Pharmacy POS (TCP $Port)"
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -Profile Private, Domain | Out-Null
Write-Host "  allowed inbound TCP $Port on private networks"
Write-Host "  (the API's own port stays closed: the tills reach it through this one)"

# Windows calls every network it has not seen before Public, and a Public
# network refuses the tills before they ever reach the platform. Changing the
# shop's router is enough to bring this back, so it is set here and checked by
# network-check.ps1.
$connection = Get-NetConnectionProfile -ErrorAction SilentlyContinue |
    Where-Object { $_.IPv4Connectivity -ne "Disconnected" } | Select-Object -First 1
if ($connection -and $connection.NetworkCategory -eq "Public") {
    Set-NetConnectionProfile -InterfaceIndex $connection.InterfaceIndex -NetworkCategory Private
    Write-Host ("  network '{0}' changed from Public to Private" -f $connection.Name)
} elseif ($connection) {
    Write-Host ("  network '{0}' is {1}" -f $connection.Name, $connection.NetworkCategory)
}

Write-Host "`n== Power" -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change disk-timeout-ac 0 | Out-Null
Write-Host "  this PC will no longer sleep while plugged in"

# Closing the lid would otherwise sleep the machine - and every till in the
# shop goes blank with it. (Power button GUID, then lid-action GUID, 0 = do
# nothing; set for both mains and battery so a power cut does not end the day.)
$buttons = "4f971e89-eebd-4455-a8de-9e59040e7347"
$lidAction = "5ca83367-6e45-459f-a27b-476b1d01c936"
powercfg /setacvalueindex SCHEME_CURRENT $buttons $lidAction 0 | Out-Null
powercfg /setdcvalueindex SCHEME_CURRENT $buttons $lidAction 0 | Out-Null
powercfg /setactive SCHEME_CURRENT | Out-Null
Write-Host "  closing the lid no longer sends it to sleep"

Write-Host "`n== Starting" -ForegroundColor Cyan
Start-ScheduledTask -TaskName $apiTask
Start-ScheduledTask -TaskName $posTask
Start-Sleep -Seconds 8

$suffix = if ($Port -eq 80) { "" } else { ":$Port" }
Write-Host "`nThe tills can open:" -ForegroundColor Green
Write-Host "  http://$env:COMPUTERNAME$suffix/   <- use this one; it survives an address change"
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
    ForEach-Object { Write-Host "  http://$($_.IPAddress)$suffix/" }

Write-Host "`nCheck it any time with: powershell -ExecutionPolicy Bypass -File .\deploy\status.ps1"
Write-Host "Check the backups with:  powershell -ExecutionPolicy Bypass -File .\deploy\check-backups.ps1`n"
