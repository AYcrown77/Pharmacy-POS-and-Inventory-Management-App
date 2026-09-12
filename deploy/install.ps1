<#
    One-time setup on the shop's server PC. Right-click PowerShell -> Run as
    Administrator, then:

        powershell -ExecutionPolicy Bypass -File .\deploy\install.ps1

    Afterwards both apps start themselves whenever the PC is switched on — no
    terminal, no npm, nobody logged in — and restart on their own if they stop.
#>
#Requires -RunAsAdministrator
param(
    # Port 80 keeps the port out of the address the staff type: http://server/
    [int]$Port = 80,
    [switch]$NoBackup
)

$ErrorActionPreference = "Stop"
$apiTask = "Mustan Pharmacy API"
$posTask = "Mustan Pharmacy POS"
$backupTask = "Mustan Pharmacy Backup"

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

Write-Host "`n== Services" -ForegroundColor Cyan
Install-AppTask -Name $apiTask -Script (Join-Path $PSScriptRoot "start-backend.ps1")
Install-AppTask -Name $posTask -Script (Join-Path $PSScriptRoot "start-frontend.ps1") -Arguments "-Port $Port"

if (-not $NoBackup) {
    $backupAction = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument ("-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"{0}`"" -f (Join-Path $PSScriptRoot "backup-db.ps1"))
    $backupTrigger = New-ScheduledTaskTrigger -Daily -At "10:00pm"
    $backupPrincipal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
    Register-ScheduledTask -TaskName $backupTask -Action $backupAction -Trigger $backupTrigger `
        -Principal $backupPrincipal -Force | Out-Null
    Write-Host "  installed: $backupTask (nightly at 10pm)"
}

Write-Host "`n== Firewall" -ForegroundColor Cyan
$ruleName = "Mustan Pharmacy POS (TCP $Port)"
Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
    -Protocol TCP -LocalPort $Port -Profile Private, Domain | Out-Null
Write-Host "  allowed inbound TCP $Port on private networks"
Write-Host "  (the API's own port stays closed: the tills reach it through this one)"

Write-Host "`n== Power" -ForegroundColor Cyan
powercfg /change standby-timeout-ac 0 | Out-Null
powercfg /change hibernate-timeout-ac 0 | Out-Null
powercfg /change disk-timeout-ac 0 | Out-Null
Write-Host "  this PC will no longer sleep while plugged in"

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

Write-Host "`nCheck it any time with: powershell -ExecutionPolicy Bypass -File .\deploy\status.ps1`n"
