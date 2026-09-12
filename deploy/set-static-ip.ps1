<#
    Gives the server PC a fixed address, so the tills' shortcut never goes
    stale.

        powershell -ExecutionPolicy Bypass -File .\deploy\set-static-ip.ps1 -IPAddress 192.168.1.240

    The gateway, subnet and network card are taken from the current connection,
    so only the address itself has to be chosen. Pick one OUTSIDE the range the
    router hands out automatically (its DHCP pool — often .100 to .199), or the
    router may later give the same address to a phone and both will drop off.

    If the laptop is ever taken to another network, put it back first:

        powershell -ExecutionPolicy Bypass -File .\deploy\set-static-ip.ps1 -Revert
#>
#Requires -RunAsAdministrator
param(
    [string]$IPAddress,
    [string]$InterfaceAlias,
    [int]$PrefixLength,
    [string]$Gateway,
    [string[]]$DnsServers,
    [switch]$Revert,
    # Sets the address even if something already answers on it.
    [switch]$Force
)

$ErrorActionPreference = "Stop"

# The card carrying the default route is the one on the shop's network.
if (-not $InterfaceAlias) {
    $route = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue |
        Sort-Object RouteMetric | Select-Object -First 1
    if (-not $route) { throw "This PC has no network connection to work from." }
    $InterfaceAlias = (Get-NetAdapter -InterfaceIndex $route.InterfaceIndex).Name
    if (-not $Gateway) { $Gateway = $route.NextHop }
}

$current = Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1

Write-Host "`n== Now" -ForegroundColor Cyan
Write-Host "  card:    $InterfaceAlias"
if ($current) {
    Write-Host ("  address: {0}/{1} ({2})" -f $current.IPAddress, $current.PrefixLength, $current.PrefixOrigin)
}
Write-Host "  gateway: $Gateway"

if ($Revert) {
    Write-Host "`n== Back to automatic (DHCP)" -ForegroundColor Cyan
    Remove-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
    Remove-NetRoute -InterfaceAlias $InterfaceAlias -DestinationPrefix "0.0.0.0/0" -Confirm:$false -ErrorAction SilentlyContinue
    Set-NetIPInterface -InterfaceAlias $InterfaceAlias -Dhcp Enabled
    Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ResetServerAddresses
    ipconfig /renew | Out-Null
    Start-Sleep -Seconds 3
    Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 |
        ForEach-Object { Write-Host ("  now: {0}/{1} ({2})" -f $_.IPAddress, $_.PrefixLength, $_.PrefixOrigin) -ForegroundColor Green }
    return
}

if (-not $IPAddress) { throw "Give the address to use, e.g. -IPAddress 192.168.1.240 (or use -Revert)." }
if (-not $PrefixLength) { $PrefixLength = if ($current) { $current.PrefixLength } else { 24 } }
if (-not $Gateway) { throw "Could not work out the router's address. Pass it with -Gateway." }
if (-not $DnsServers) { $DnsServers = @($Gateway, "8.8.8.8") }

function Get-NetworkId {
    param([string]$Address, [int]$Prefix)
    $bytes = ([System.Net.IPAddress]::Parse($Address)).GetAddressBytes()
    [array]::Reverse($bytes)
    $value = [uint32][System.BitConverter]::ToUInt32($bytes, 0)
    $mask = if ($Prefix -eq 0) { [uint32]0 } else { [uint32](((0xFFFFFFFFL -shl (32 - $Prefix)) -band 0xFFFFFFFFL)) }
    return $value -band $mask
}

if ((Get-NetworkId $IPAddress $PrefixLength) -ne (Get-NetworkId $Gateway $PrefixLength)) {
    throw "$IPAddress is not on the same network as the router ($Gateway/$PrefixLength). Choose an address like $($Gateway.Substring(0, $Gateway.LastIndexOf('.'))).240"
}

if ($current -and $current.IPAddress -ne $IPAddress -and -not $Force) {
    Write-Host "`n== Checking $IPAddress is free" -ForegroundColor Cyan
    if (Test-Connection -ComputerName $IPAddress -Count 2 -Quiet -ErrorAction SilentlyContinue) {
        throw "Something already answers on $IPAddress. Pick another address, or pass -Force if you know that reply is this PC."
    }
    Write-Host "  nothing answered - free to use"
}

Write-Host "`n== Setting the address" -ForegroundColor Cyan
Set-NetIPInterface -InterfaceAlias $InterfaceAlias -Dhcp Disabled
Remove-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 -Confirm:$false -ErrorAction SilentlyContinue
Remove-NetRoute -InterfaceAlias $InterfaceAlias -DestinationPrefix "0.0.0.0/0" -Confirm:$false -ErrorAction SilentlyContinue
New-NetIPAddress -InterfaceAlias $InterfaceAlias -IPAddress $IPAddress -PrefixLength $PrefixLength -DefaultGateway $Gateway | Out-Null
# A static address means DNS has to be named too, or nothing resolves.
Set-DnsClientServerAddress -InterfaceAlias $InterfaceAlias -ServerAddresses $DnsServers
Start-Sleep -Seconds 3

Write-Host "`n== Checking it works" -ForegroundColor Cyan
$ok = $true
if (Test-Connection -ComputerName $Gateway -Count 2 -Quiet -ErrorAction SilentlyContinue) {
    Write-Host "  router reachable" -ForegroundColor Green
} else {
    Write-Host "  cannot reach the router at $Gateway" -ForegroundColor Red
    $ok = $false
}
try {
    Resolve-DnsName -Name "www.google.com" -QuickTimeout -ErrorAction Stop | Out-Null
    Write-Host "  names resolve" -ForegroundColor Green
} catch {
    Write-Host "  DNS is not resolving - check the DNS servers ($($DnsServers -join ', '))" -ForegroundColor Yellow
}

Get-NetIPAddress -InterfaceAlias $InterfaceAlias -AddressFamily IPv4 |
    ForEach-Object { Write-Host ("`n  address now: {0}/{1} ({2})" -f $_.IPAddress, $_.PrefixLength, $_.PrefixOrigin) }

if (-not $ok) {
    Write-Host "`nIf the connection is broken, put it back with:" -ForegroundColor Yellow
    Write-Host "  powershell -ExecutionPolicy Bypass -File .\deploy\set-static-ip.ps1 -Revert`n"
} else {
    Write-Host "`nReserve this address in the router too, if you can, so it is never handed to anything else.`n"
}
