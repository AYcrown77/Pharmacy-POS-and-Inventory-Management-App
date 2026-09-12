<#
    Shared helpers. Dot-sourced by the other scripts in this folder.
#>

<#
    Finds the API's folder.

    The two projects are not always checked out side by side, and the folder
    names differ from machine to machine — so rather than assume, look for a
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
