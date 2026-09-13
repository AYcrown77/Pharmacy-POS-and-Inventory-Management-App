<#
    Run this ON A TILL (not the server), as Administrator:

        powershell -ExecutionPolicy Bypass -File .\connect-till.ps1

    It checks this PC can reach the shop's server, teaches Windows the name
    "mustan" so nobody has to remember an address, and puts a full-screen
    shortcut on the desktop.
#>
#Requires -RunAsAdministrator
param(
    [string]$ServerAddress = "192.168.1.10",
    [string]$ServerName = "mustan",
    [ValidateSet("pos", "dashboard")]
    [string]$Page = "pos",
    [switch]$NoShortcut
)

$ErrorActionPreference = "Stop"

Write-Host "`n== Can this PC reach the server?" -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri "http://$ServerAddress/api/health"
    Write-Host "  yes - the server answered ($($health.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  no - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host @"

  Work through these, in order:
   1. This PC is on the same Wi-Fi (or cable) as the server. Run ipconfig here:
      its address should start with 192.168.1
   2. ON THE SERVER, the network must be Private, not Public:
        Get-NetConnectionProfile
        Set-NetConnectionProfile -InterfaceAlias "Wi-Fi" -NetworkCategory Private
      A Public network blocks other PCs from connecting at all.
   3. ON THE SERVER, the firewall must allow port 80 - deploy\install.ps1 adds
      that rule, so re-run it if it was skipped.
"@ -ForegroundColor Yellow
    return
}

Write-Host "`n== Teaching this PC the name '$ServerName'" -ForegroundColor Cyan
# Windows can usually find the server by name on its own, but that depends on
# settings that vary by network. A hosts entry is not clever, and that is the
# point: it works every time, and the server's address no longer changes.
$hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
$entry = "$ServerAddress`t$ServerName"
$kept = @(Get-Content $hostsFile -ErrorAction SilentlyContinue |
    Where-Object { $_ -notmatch "\s$ServerName\s*$" })
($kept + $entry) | Set-Content -Path $hostsFile -Encoding ascii
Write-Host "  added: $entry"

try {
    $byName = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri "http://$ServerName/api/health"
    Write-Host "  http://$ServerName/ works ($($byName.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  http://$ServerName/ did not answer: $($_.Exception.Message)" -ForegroundColor Yellow
    Write-Host "  use http://$ServerAddress/ for now" -ForegroundColor Yellow
}

if (-not $NoShortcut) {
    Write-Host "`n== Desktop shortcut" -ForegroundColor Cyan
    $chrome = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $chrome) {
        Write-Host "  Chrome not found - just open http://$ServerName/$Page in this PC's browser" -ForegroundColor Yellow
    } else {
        $shortcut = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "Mustan Pharmacy.lnk"
        $shell = New-Object -ComObject WScript.Shell
        $link = $shell.CreateShortcut($shortcut)
        $link.TargetPath = $chrome
        $link.Arguments = "--kiosk --app=http://$ServerName/$Page"
        $link.WorkingDirectory = Split-Path $chrome
        $link.Description = "Mustan Healthcare Pharmacy"
        $link.Save()
        Write-Host "  created on the desktop: Mustan Pharmacy" -ForegroundColor Green
        Write-Host "  it opens full screen; Alt+F4 closes it"
    }
}

Write-Host "`nDone. This till opens: http://$ServerName/$Page`n" -ForegroundColor Green
