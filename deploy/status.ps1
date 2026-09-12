<#
    Is the platform up? Run any time — no Administrator needed.

        powershell -ExecutionPolicy Bypass -File .\deploy\status.ps1
#>
param([int]$Port = 80)

$ErrorActionPreference = "Continue"

Write-Host "`n== Services" -ForegroundColor Cyan
foreach ($name in "Mustan Pharmacy API", "Mustan Pharmacy POS", "Mustan Pharmacy Backup") {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if (-not $task) { Write-Host "  $name : NOT INSTALLED" -ForegroundColor Yellow; continue }
    $info = Get-ScheduledTaskInfo -TaskName $name
    Write-Host ("  {0,-24} {1,-8} last run {2} (result {3})" -f $name, $task.State, $info.LastRunTime, $info.LastTaskResult)
}

Write-Host "`n== Ports" -ForegroundColor Cyan
foreach ($p in @($Port, 5000, 4000)) {
    $listening = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
    if ($listening) {
        $owner = (Get-Process -Id $listening[0].OwningProcess -ErrorAction SilentlyContinue).ProcessName
        Write-Host ("  {0,-6} listening ({1})" -f $p, $owner)
    }
}

Write-Host "`n== Health" -ForegroundColor Cyan
foreach ($url in @("http://127.0.0.1:$Port/", "http://127.0.0.1:$Port/api/health")) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri $url
        Write-Host ("  {0,-42} {1}" -f $url, $response.StatusCode) -ForegroundColor Green
    } catch {
        Write-Host ("  {0,-42} {1}" -f $url, $_.Exception.Message) -ForegroundColor Red
    }
}

Write-Host "`n== Last errors logged" -ForegroundColor Cyan
$logDir = Join-Path $PSScriptRoot "logs"
if (Test-Path $logDir) {
    Get-ChildItem $logDir -Filter "*.err.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 2 | ForEach-Object {
            $lines = Get-Content $_.FullName -Tail 5 -ErrorAction SilentlyContinue
            if ($lines) { Write-Host "  --- $($_.Name)"; $lines | ForEach-Object { Write-Host "      $_" } }
        }
} else {
    Write-Host "  no logs yet"
}

$suffix = if ($Port -eq 80) { "" } else { ":$Port" }
Write-Host "`nTills open: http://$env:COMPUTERNAME$suffix/`n"
