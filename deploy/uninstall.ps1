<#
    Removes the services and the firewall rule. The apps, the database and the
    backups are left alone.
#>
#Requires -RunAsAdministrator
param([int]$Port = 80)

$ErrorActionPreference = "Continue"

foreach ($name in "Mustan Pharmacy POS", "Mustan Pharmacy API", "Mustan Pharmacy Backup") {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $name -Confirm:$false
        Write-Host "removed: $name"
    }
}

Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match "bin.next.+start|dist.index.js" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Get-NetFirewallRule -DisplayName "Mustan Pharmacy POS (TCP $Port)" -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Write-Host "removed: firewall rule for TCP $Port"
