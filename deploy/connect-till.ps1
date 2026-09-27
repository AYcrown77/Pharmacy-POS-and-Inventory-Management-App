<#
    Run this ON A TILL (not the server), as Administrator:

        powershell -ExecutionPolicy Bypass -File .\connect-till.ps1

    It checks this PC can reach the shop's server, teaches Windows the name
    "mustan" so nobody has to remember an address, and puts a full-screen
    shortcut on the desktop.
#>
#Requires -RunAsAdministrator
param(
    # Left out, this asks the network for the server by name. Give the address
    # when the shop's router has changed and this till still holds the old one:
    #   -ServerAddress 192.168.8.10
    [string]$ServerAddress,
    [string]$ServerName = "mustan",
    [ValidateSet("pos", "dashboard")]
    [string]$Page = "pos",
    [switch]$NoShortcut
)

$ErrorActionPreference = "Stop"

# No address given: ask the network where the server is. Windows finds other
# machines by name on the same network, and a name cannot go stale the way the
# address written into this till's hosts file does when the router changes.
if (-not $ServerAddress) {
    Write-Host "`n== Looking for '$ServerName' on this network" -ForegroundColor Cyan
    # A stale hosts entry would answer this lookup with the old address, so it
    # is ignored here: only what the network itself says counts.
    $hostsFile = "$env:SystemRoot\System32\drivers\etc\hosts"
    $stale = @(Get-Content $hostsFile -ErrorAction SilentlyContinue | Where-Object { $_ -match "\s$ServerName\s*$" })
    if ($stale.Count -gt 0) {
        Set-Content -Path $hostsFile -Encoding ascii -Value @(
            Get-Content $hostsFile | Where-Object { $_ -notmatch "\s$ServerName\s*$" })
        Write-Host ("  ignoring what this till had written down: {0}" -f ($stale -join "; "))
    }

    $found = Resolve-DnsName -Name $ServerName -Type A -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress } | Select-Object -First 1
    if ($found) {
        $ServerAddress = $found.IPAddress
        Write-Host "  found at $ServerAddress" -ForegroundColor Green
    } else {
        Write-Host "  not found by name." -ForegroundColor Yellow
        Write-Host "  On the server PC run deploy\network-check.ps1 - it prints the address to use here:"
        Write-Host "    powershell -ExecutionPolicy Bypass -File .\connect-till.ps1 -ServerAddress <that address>`n"
        return
    }
}

Write-Host "`n== Can this PC reach the server?" -ForegroundColor Cyan
try {
    $health = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 -Uri "http://$ServerAddress/api/health"
    Write-Host "  yes - the server answered ($($health.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "  no - $($_.Exception.Message)" -ForegroundColor Red
    Write-Host @"

  Work through these, in order:
   1. Check the address above is where the server actually is NOW. The router
      remembers names from earlier, so a lookup can answer with an address the
      server used last week. ON THE SERVER run ipconfig, then come back here:
        powershell -ExecutionPolicy Bypass -File .\connect-till.ps1 -ServerAddress <that address>
   2. This PC is on the same Wi-Fi (or cable) as the server - the same router,
      and not its guest network. Run ipconfig here: all but the last number of
      this PC's address should match the server's.
   3. ON THE SERVER, one command checks the rest of this and puts it right:
        powershell -ExecutionPolicy Bypass -File .\deploy\network-check.ps1 -Fix
      It covers the two usual causes: Windows treating the new network as
      Public (which blocks other PCs outright), and the firewall rule for
      port 80 being missing.
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
