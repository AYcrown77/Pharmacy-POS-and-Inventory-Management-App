<#
    Run this ON THE SERVER PC when the tills stop loading the platform, or
    after the shop's router is changed:

        powershell -ExecutionPolicy Bypass -File .\deploy\network-check.ps1

    It only looks. To let it put things right, run it as Administrator with:

        powershell -ExecutionPolicy Bypass -File .\deploy\network-check.ps1 -Fix

    A new router is a new network, and three things from the old one are left
    behind: a fixed address that belongs to a network that no longer exists,
    Windows treating the new network as Public (which blocks every other PC),
    and each till's shortcut still pointing at the old address.
#>
param(
    [int]$Port = 80,
    [switch]$Fix
)

$ErrorActionPreference = "Continue"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
if ($Fix -and -not $isAdmin) {
    Write-Host "`n-Fix needs Administrator. Right-click PowerShell -> Run as Administrator.`n" -ForegroundColor Red
    exit 1
}

$problems = @()
function Add-Problem {
    param([string]$What, [string]$Fix)
    # Said where it is found as well as in the summary, so a long check does
    # not look like it passed everything until the very end.
    Write-Host "  $What" -ForegroundColor Red
    $script:problems += [pscustomobject]@{ What = $What; Fix = $Fix }
}

# ------------------------------------------------------------------ the card
Write-Host "`n== This PC on the network" -ForegroundColor Cyan
$route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
    Sort-Object RouteMetric | Select-Object -First 1
$adapter = if ($route) { Get-NetAdapter -InterfaceIndex $route.InterfaceIndex -ErrorAction SilentlyContinue }
if (-not $adapter) {
    # No default route at all: nothing is plugged in, or Wi-Fi is off.
    Write-Host "  no network connection at all" -ForegroundColor Red
    Write-Host "  fix: connect this PC to the shop's router (cable preferred), then run this again`n"
    exit 1
}

$address = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -First 1
$gateway = $route.NextHop
$dns = (Get-DnsClientServerAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).ServerAddresses

Write-Host ("  card:    {0} ({1})" -f $adapter.Name, $adapter.Status)
Write-Host ("  address: {0}/{1}  [{2}]" -f $address.IPAddress, $address.PrefixLength, $(if ($address.PrefixOrigin -eq "Manual") { "fixed by hand" } else { "from the router" }))
Write-Host ("  router:  {0}" -f $gateway)
Write-Host ("  dns:     {0}" -f ($dns -join ", "))
Write-Host ("  name:    {0}  ->  tills can use http://{0}/" -f $env:COMPUTERNAME)

# ------------------------------------------- is the address from this router?
function Get-NetworkId {
    param([string]$Ip, [int]$Prefix)
    $bytes = ([System.Net.IPAddress]::Parse($Ip)).GetAddressBytes()
    [array]::Reverse($bytes)
    $value = [uint32][System.BitConverter]::ToUInt32($bytes, 0)
    $mask = if ($Prefix -eq 0) { [uint32]0 } else { [uint32](((0xFFFFFFFFL -shl (32 - $Prefix)) -band 0xFFFFFFFFL)) }
    return $value -band $mask
}

$staleAddress = $false
if ($address.IPAddress -like "169.254.*") {
    # Windows makes one of these up when no router answered.
    Add-Problem "This PC gave itself an address ($($address.IPAddress)) - the router never answered." `
        "Check the cable or Wi-Fi, then run with -Fix"
    $staleAddress = $true
} elseif ($address.PrefixOrigin -eq "Manual") {
    $sameNetwork = (Get-NetworkId $address.IPAddress $address.PrefixLength) -eq (Get-NetworkId $gateway $address.PrefixLength)
    $routerAnswers = Test-Connection -ComputerName $gateway -Count 2 -Quiet -ErrorAction SilentlyContinue
    if (-not $sameNetwork -or -not $routerAnswers) {
        # The fixed address was chosen for the old router. The new one hands out
        # a different range, so this PC is shouting down a road that no longer
        # exists: no internet here, and no tills able to reach it.
        Add-Problem "The fixed address $($address.IPAddress) belongs to the OLD router, not this one ($gateway)." `
            "Run with -Fix: it puts this PC back on automatic so the new router gives it an address"
        $staleAddress = $true
    } else {
        Write-Host "  the fixed address matches this router" -ForegroundColor Green
    }
}

if (-not $staleAddress -and $address.PrefixOrigin -ne "Manual") {
    Write-Host "  the router gave this PC its address" -ForegroundColor Green
}

# ------------------------------------------------------ public or private?
Write-Host "`n== Is this network Private?" -ForegroundColor Cyan
$profileInfo = Get-NetConnectionProfile -InterfaceIndex $adapter.InterfaceIndex -ErrorAction SilentlyContinue
if (-not $profileInfo) {
    Write-Host "  could not read the network profile" -ForegroundColor Yellow
} elseif ($profileInfo.NetworkCategory -eq "Public") {
    # Windows calls every new network Public until told otherwise, and Public
    # blocks other PCs from connecting - which is exactly what a till is.
    Add-Problem "Windows has this network as Public ('$($profileInfo.Name)'), which blocks the tills." `
        "Run with -Fix, or: Set-NetConnectionProfile -InterfaceIndex $($adapter.InterfaceIndex) -NetworkCategory Private"
} else {
    Write-Host ("  {0} - {1}" -f $profileInfo.Name, $profileInfo.NetworkCategory) -ForegroundColor Green
}

# ---------------------------------------------------------------- firewall
Write-Host "`n== Firewall" -ForegroundColor Cyan
$ruleName = "Mustan Pharmacy POS (TCP $Port)"
$rule = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $rule) {
    Add-Problem "No firewall rule for port $Port - the tills are refused before they reach the platform." `
        "Run with -Fix, or re-run install.ps1 as Administrator"
} elseif ($rule.Enabled -ne "True") {
    Add-Problem "The firewall rule for port $Port is switched off." "Run with -Fix"
} else {
    Write-Host ("  {0}: allowed on {1}" -f $ruleName, $rule.Profile) -ForegroundColor Green
}

# ---------------------------------------------------------------- services
Write-Host "`n== The platform itself" -ForegroundColor Cyan
foreach ($name in "Mustan Pharmacy API", "Mustan Pharmacy POS") {
    $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
    if (-not $task) {
        Add-Problem "$name is not installed." "Run install.ps1 as Administrator"
    } elseif ($task.State -ne "Running") {
        Add-Problem "$name is not running (it is '$($task.State)')." "Run with -Fix, or: Start-ScheduledTask -TaskName '$name'"
    } else {
        Write-Host "  $name is running" -ForegroundColor Green
    }
}

$listening = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($listening) { Write-Host "  something is answering on port $Port" -ForegroundColor Green }
else { Add-Problem "Nothing is listening on port $Port." "Run with -Fix to start the services" }

# ------------------------------------------------------------------- fixing
if ($Fix -and $problems.Count -gt 0) {
    Write-Host "`n== Fixing" -ForegroundColor Cyan

    if ($staleAddress) {
        Write-Host "  putting the network card back on automatic..."
        & (Join-Path $PSScriptRoot "set-static-ip.ps1") -Revert -InterfaceAlias $adapter.Name
        Start-Sleep -Seconds 3
        $address = Get-NetIPAddress -InterfaceIndex $adapter.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object { $_.IPAddress -notlike "127.*" } | Select-Object -First 1
        $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -InterfaceIndex $adapter.InterfaceIndex -ErrorAction SilentlyContinue |
            Sort-Object RouteMetric | Select-Object -First 1
        if ($route) { $gateway = $route.NextHop }
    }

    $profileInfo = Get-NetConnectionProfile -InterfaceIndex $adapter.InterfaceIndex -ErrorAction SilentlyContinue
    if ($profileInfo -and $profileInfo.NetworkCategory -eq "Public") {
        Set-NetConnectionProfile -InterfaceIndex $adapter.InterfaceIndex -NetworkCategory Private
        Write-Host "  network set to Private"
    }

    Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Action Allow `
        -Protocol TCP -LocalPort $Port -Profile Private, Domain | Out-Null
    Write-Host "  firewall rule for port $Port put back"

    foreach ($name in "Mustan Pharmacy API", "Mustan Pharmacy POS") {
        $task = Get-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
        if ($task -and $task.State -ne "Running") { Start-ScheduledTask -TaskName $name; Write-Host "  started $name" }
    }
    Start-Sleep -Seconds 6
}

# ------------------------------------------------------------------ verdict
Write-Host "`n== Can the platform be reached?" -ForegroundColor Cyan
$reachable = $false
foreach ($url in @("http://127.0.0.1:$Port/api/health", "http://$($address.IPAddress):$Port/api/health")) {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 8 -Uri $url
        Write-Host ("  {0,-40} {1}" -f $url, $response.StatusCode) -ForegroundColor Green
        $reachable = $true
    } catch {
        Write-Host ("  {0,-40} {1}" -f $url, $_.Exception.Message) -ForegroundColor Red
    }
}

if ($problems.Count -gt 0 -and -not $Fix) {
    Write-Host "`nFound:" -ForegroundColor Red
    foreach ($problem in $problems) {
        Write-Host ("  - {0}" -f $problem.What)
        Write-Host ("    {0}" -f $problem.Fix) -ForegroundColor Yellow
    }
    Write-Host "`nFix them in one go (as Administrator):" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\deploy\network-check.ps1 -Fix`n"
    exit 1
}

$suffix = if ($Port -eq 80) { "" } else { ":$Port" }
Write-Host "`n== What the tills should open" -ForegroundColor Cyan
Write-Host ("  http://{0}{1}/        <- use this one, it survives the next address change" -f $env:COMPUTERNAME, $suffix) -ForegroundColor Green
Write-Host ("  http://{0}{1}/" -f $address.IPAddress, $suffix)
Write-Host "`nOn EACH till, as Administrator, point it at this PC again:" -ForegroundColor Cyan
Write-Host ("  powershell -ExecutionPolicy Bypass -File .\connect-till.ps1 -ServerAddress {0}" -f $address.IPAddress)
Write-Host "  (a till still holds the OLD address until this is re-run there)"

if (-not $reachable) {
    Write-Host "`nStill not answering. Worth checking on the router itself:" -ForegroundColor Yellow
    Write-Host "  - 'AP isolation' or 'client isolation' must be OFF. Some mobile routers"
    Write-Host "    ship with it on, and it stops the laptops seeing each other at all."
    Write-Host "  - the tills must be on the same Wi-Fi as this PC, not a guest network."
}
Write-Host ""
