<#
    Applies a new version. Run as Administrator after `git pull` in both
    folders:

        powershell -ExecutionPolicy Bypass -File .\deploy\update.ps1

    Stops the services, rebuilds, migrates the database, starts them again.
#>
#Requires -RunAsAdministrator
param([int]$Port = 80)

$ErrorActionPreference = "Stop"

Write-Host "`n== Stopping" -ForegroundColor Cyan
foreach ($name in "Mustan Pharmacy POS", "Mustan Pharmacy API") {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if ($task) { Stop-ScheduledTask -TaskName $name; Write-Host "  stopped: $name" }
}
# The task stops the launcher; make sure the node processes are gone too.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match "bin.next.+start|dist.index.js" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

& (Join-Path $PSScriptRoot "build.ps1")

Write-Host "`n== Starting" -ForegroundColor Cyan
foreach ($name in "Mustan Pharmacy API", "Mustan Pharmacy POS") {
    if (Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue) {
        Start-ScheduledTask -TaskName $name
        Write-Host "  started: $name"
    }
}
Start-Sleep -Seconds 8
& (Join-Path $PSScriptRoot "status.ps1") -Port $Port
