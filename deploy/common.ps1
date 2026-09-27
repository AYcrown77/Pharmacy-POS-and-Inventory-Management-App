<#
    Shared helpers. Dot-sourced by the other scripts in this folder.
#>

<#
    Finds the API's folder.

    The two projects are not always checked out side by side, and the folder
    names differ from machine to machine - so rather than assume, look for a
    folder that *is* the API: a package.json with this project's scripts, and
    a src\index.ts next to it.
#>
function Resolve-BackendDir {
    param(
        # Given by the caller (-BackendDir); used as-is when present.
        [string]$Hint,
        [string]$AppDir
    )

    if ($Hint) {
        if (-not (Test-Path $Hint)) { throw "No such folder: $Hint" }
        return (Resolve-Path $Hint).Path
    }

    function Test-IsBackend {
        param([string]$Dir)
        $package = Join-Path $Dir "package.json"
        if (-not (Test-Path $package)) { return $false }
        if (-not (Test-Path (Join-Path $Dir "src\index.ts"))) { return $false }
        try { $json = Get-Content $package -Raw | ConvertFrom-Json } catch { return $false }
        return [bool]($json.scripts.migrate -and $json.scripts.start)
    }

    $parent = Split-Path $AppDir -Parent
    $searched = @()
    # Beside the platform, then inside it (a single repo holding both), then
    # one level further out.
    foreach ($root in @($parent, $AppDir, (Split-Path $parent -Parent))) {
        if (-not $root -or -not (Test-Path $root)) { continue }
        $searched += $root
        foreach ($dir in Get-ChildItem -Path $root -Directory -ErrorAction SilentlyContinue) {
            if ($dir.FullName -eq $AppDir) { continue }
            if (Test-IsBackend -Dir $dir.FullName) { return $dir.FullName }
        }
    }

    throw @"
Could not find the API folder. Looked in:
  $($searched -join "`n  ")
Run the script again naming it, for example:
  -BackendDir "C:\Users\musta\Documents\Mustan\mutaan-backend"
"@
}

<#
    Reads the API's .env into a hashtable.

    The database password lives in here. Callers hand it straight to PostgreSQL
    through the environment; it is never printed, logged or written anywhere.
#>
function Read-EnvSettings {
    param([string]$BackendDir)

    $envFile = Join-Path $BackendDir ".env"
    if (-not (Test-Path $envFile)) { throw "$envFile is missing." }

    $settings = @{}
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$") {
            # Values are sometimes quoted; the quotes are not part of the value.
            $settings[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
        }
    }

    foreach ($required in "DB_NAME", "DB_USER", "DB_HOST", "DB_PORT") {
        if (-not $settings[$required]) { throw "$required is missing from $envFile." }
    }

    return $settings
}

<#
    Finds a PostgreSQL command-line tool, newest version first.

    Installed versions differ from machine to machine, so nothing here hardcodes
    a version number.
#>
function Get-PgTool {
    param([string]$Name)

    $tool = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\$Name.exe" -ErrorAction SilentlyContinue |
        Sort-Object FullName -Descending | Select-Object -First 1
    if (-not $tool) {
        $onPath = Get-Command "$Name.exe" -ErrorAction SilentlyContinue
        if ($onPath) { return $onPath.Source }
        throw "$Name.exe not found under C:\Program Files\PostgreSQL."
    }

    return $tool.FullName
}

<#
    Runs a PostgreSQL tool with the password supplied through the environment.

    Returns the tool's output; throws on a non-zero exit code. -w tells the tool
    never to stop and ask for a password: a scheduled task has nobody to answer,
    and waiting forever would look exactly like a backup that runs but never
    finishes.
#>
function Invoke-PgTool {
    param(
        [string]$Exe,
        [string[]]$Arguments,
        [hashtable]$Settings,
        [string]$Database
    )

    $all = @("-w", "-U", $Settings["DB_USER"], "-h", $Settings["DB_HOST"], "-p", $Settings["DB_PORT"])
    if ($Database) { $all += @("-d", $Database) }
    $all += $Arguments

    $env:PGPASSWORD = $Settings["DB_PASSWORD"]
    # These tools write ordinary progress and NOTICE lines to stderr, and
    # PowerShell 5.1 turns every one of them into an error that would stop the
    # script. The exit code is the verdict; the stderr text is only useful when
    # that code says something went wrong.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try {
        $output = & $Exe @all 2>&1
        $messages = @($output | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] })
        $result = @($output | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] })
        if ($LASTEXITCODE -ne 0) {
            $detail = (@($messages + $result) | Select-Object -Last 5) -join "; "
            throw ("{0} failed ({1}): {2}" -f (Split-Path $Exe -Leaf), $LASTEXITCODE, $detail)
        }
        return $result
    } finally {
        $ErrorActionPreference = $previous
        Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    }
}

<# The file every backup script writes to and every check reads from. #>
function Get-BackupStatusPath {
    param([string]$OutDir)
    return (Join-Path $OutDir "backup-status.json")
}

function Read-BackupStatus {
    param([string]$OutDir)

    $path = Get-BackupStatusPath -OutDir $OutDir
    if (Test-Path $path) {
        try { return (Get-Content $path -Raw | ConvertFrom-Json) } catch { }
    }
    return [pscustomobject]@{}
}

function Save-BackupStatus {
    param([string]$OutDir, $Status)

    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $Status | ConvertTo-Json -Depth 8 | Set-Content -Path (Get-BackupStatusPath -OutDir $OutDir) -Encoding utf8
}

<# Adds or replaces a property on a PSCustomObject read back from JSON. #>
function Set-StatusValue {
    param($Status, [string]$Name, $Value)

    if ($Status.PSObject.Properties.Name -contains $Name) { $Status.$Name = $Value }
    else { $Status | Add-Member -NotePropertyName $Name -NotePropertyValue $Value }
    return $Status
}

<# "4 minutes ago", "2 days ago" - for people, not for parsing. #>
function Format-Age {
    param($When)

    if (-not $When) { return "never" }
    $span = (Get-Date) - [datetime]$When
    if ($span.TotalMinutes -lt 1) { return "just now" }
    foreach ($unit in @(
        @{ Value = $span.TotalMinutes; Name = "minute"; Limit = 60 },
        @{ Value = $span.TotalHours; Name = "hour"; Limit = 48 },
        @{ Value = $span.TotalDays; Name = "day"; Limit = [double]::MaxValue }
    )) {
        if ($unit.Value -lt $unit.Limit) {
            $whole = [Math]::Floor($unit.Value)
            $plural = if ($whole -eq 1) { "" } else { "s" }
            return "{0:N0} {1}{2} ago" -f $whole, $unit.Name, $plural
        }
    }
}

<#
    Thins a folder of backups: every backup from the last few days, then one a
    day for a month, then one a month for a year.

    Keeping every hourly dump for ever would fill the disk; keeping only the
    newest few would mean a mistake noticed on Monday has already overwritten
    the good copy from Friday.
#>
function Remove-OldBackups {
    param(
        [string]$Dir,
        [int]$AllDays = 3,
        [int]$DailyDays = 30,
        [int]$MonthlyMonths = 12
    )

    # "pre-" files are the copies taken just before a restore or a reset. They
    # are not part of the schedule and must not be thinned away with it.
    $files = @(Get-ChildItem $Dir -Filter "*.dump" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -notlike "pre-*" })
    if ($files.Count -eq 0) { return 0 }

    $now = Get-Date
    $keep = @{}
    foreach ($file in $files | Where-Object { $_.LastWriteTime -ge $now.AddDays(-$AllDays) }) {
        $keep[$file.FullName] = $true
    }
    foreach ($window in @(
        @{ Since = $now.AddDays(-$DailyDays); Format = "yyyy-MM-dd" },
        @{ Since = $now.AddMonths(-$MonthlyMonths); Format = "yyyy-MM" }
    )) {
        $inWindow = @($files | Where-Object { $_.LastWriteTime -ge $window.Since })
        foreach ($group in ($inWindow | Group-Object { $_.LastWriteTime.ToString($window.Format) })) {
            $newest = ($group.Group | Sort-Object LastWriteTime -Descending)[0]
            $keep[$newest.FullName] = $true
        }
    }

    $removed = 0
    foreach ($file in $files) {
        if (-not $keep.ContainsKey($file.FullName)) {
            Remove-Item $file.FullName -Force -ErrorAction SilentlyContinue
            $removed++
        }
    }

    # Those safety copies should not pile up for ever either.
    Get-ChildItem $Dir -Filter "pre-*.dump" -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $now.AddDays(-90) } |
        ForEach-Object { Remove-Item $_.FullName -Force -ErrorAction SilentlyContinue; $removed++ }

    return $removed
}
