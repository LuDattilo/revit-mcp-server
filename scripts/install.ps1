#Requires -Version 5.1
<#
.SYNOPSIS
    Universal installer for mcp-servers-for-revit.

.DESCRIPTION
    Fully standalone — no external dependencies.
    - Detects installed Revit versions 2021-2027 via registry and filesystem
    - Downloads the matching ZIP from GitHub Releases
    - Extracts to the Addins folder, unblocks DLLs, verifies required files
    - Checks Node.js 18+ availability (warns only, does not auto-install)
    - Optionally updates Claude Desktop claude_desktop_config.json
    - Prints a per-version summary table at the end

.PARAMETER RevitVersion
    Target a specific Revit version (2021-2027). If omitted, all detected versions are installed.

.PARAMETER Tag
    GitHub release tag to install (e.g. "v1.2.0"). Defaults to "latest".

.PARAMETER Uninstall
    Remove the plugin from all detected (or specified) Revit versions.

.PARAMETER Force
    Skip the replace/skip prompt and always overwrite an existing installation.

.PARAMETER SkipNodeCheck
    Skip the Node.js prerequisite check.

.PARAMETER SkipMcpConfig
    Skip Claude Desktop MCP server configuration.

.EXAMPLE
    .\install.ps1
    # Auto-detect all Revit versions, install latest release

.EXAMPLE
    .\install.ps1 -RevitVersion 2025 -Tag v1.2.0

.EXAMPLE
    .\install.ps1 -Uninstall

.EXAMPLE
    powershell -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/AmrCodesHere/revit-mcp-server/main/scripts/install.ps1 | iex"
    # One-liner install directly from GitHub
#>
param(
    [ValidateSet('2021','2022','2023','2024','2025','2026','2027')]
    [string]$RevitVersion,
    [string]$Tag = 'latest',
    [switch]$Uninstall,
    [switch]$Force,
    [switch]$SkipNodeCheck,
    [switch]$SkipMcpConfig
)

$ErrorActionPreference = 'Stop'
$ProgressPreference    = 'SilentlyContinue'

# Guard against stale $Tag from caller scope when piped via irm | iex
if ([string]::IsNullOrWhiteSpace($Tag)) { $Tag = 'latest' }

# Force TLS 1.2 — required for GitHub API on older Windows 10 builds
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ── Constants ────────────────────────────────────────────────────────────────
$REPO        = 'AmrCodesHere/revit-mcp-server'
$PLUGIN_NAME = 'mcp-servers-for-revit'
$ADDIN_FILE  = "$PLUGIN_NAME.addin"
$PLUGIN_DLL  = 'RevitMCPPlugin.dll'
$REVIT_YEARS = 2021..2027
$MIN_NODE    = 18

# ── Colour helpers ───────────────────────────────────────────────────────────
function Write-Step { param([string]$m) Write-Host "  [*] $m" -ForegroundColor Cyan   }
function Write-OK   { param([string]$m) Write-Host "  [+] $m" -ForegroundColor Green  }
function Write-Warn { param([string]$m) Write-Host "  [!] $m" -ForegroundColor Yellow }
function Write-Err  { param([string]$m) Write-Host "  [x] $m" -ForegroundColor Red    }
function Write-Info { param([string]$m) Write-Host "      $m" -ForegroundColor DarkGray }

# ── Detect installed Revit versions ──────────────────────────────────────────
function Get-InstalledRevitVersions {
    param([string[]]$Limit = @())
    $found = [System.Collections.Generic.List[PSCustomObject]]::new()
    foreach ($year in $REVIT_YEARS) {
        if ($Limit.Count -gt 0 -and $year.ToString() -notin $Limit) { continue }

        $regPaths = @(
            "HKLM:\SOFTWARE\Autodesk\Revit\$year",
            "HKLM:\SOFTWARE\WOW6432Node\Autodesk\Revit\$year"
        )
        $exePath = "$env:ProgramFiles\Autodesk\Revit $year\Revit.exe"

        $inReg = ($regPaths | Where-Object { Test-Path $_ }).Count -gt 0
        $inExe = Test-Path $exePath

        if ($inReg -or $inExe) {
            $found.Add([PSCustomObject]@{
                Year      = $year
                AddinsDir = "$env:APPDATA\Autodesk\Revit\Addins\$year"
                Detection = if ($inReg) { 'registry' } else { 'filesystem' }
            })
        }
    }
    return $found
}

# ── GitHub release helpers ────────────────────────────────────────────────────
function Get-Release {
    param([string]$Tag)
    $headers = @{ 'User-Agent' = 'mcp-revit-installer'; 'Accept' = 'application/vnd.github+json' }
    $uri = if ($Tag -eq 'latest') {
        "https://api.github.com/repos/$REPO/releases/latest"
    } else {
        "https://api.github.com/repos/$REPO/releases/tags/$Tag"
    }
    return Invoke-RestMethod -Uri $uri -Headers $headers
}

function Get-AssetForYear {
    param($Release, [int]$Year)
    return $Release.assets |
        Where-Object { $_.name -like "mcp-servers-for-revit-*-Revit$Year.zip" } |
        Select-Object -First 1
}

# ── Install for one Revit version ─────────────────────────────────────────────
function Install-ForVersion {
    param($Version, $Release, [bool]$ForceInstall)

    $year      = $Version.Year
    $addinsDir = $Version.AddinsDir
    $result    = [PSCustomObject]@{ Year = $year; Success = $false; AddinPath = ''; Error = '' }

    try {
        $asset = Get-AssetForYear -Release $Release -Year $year
        if (-not $asset) {
            $result.Error = "No release asset found for Revit $year"
            return $result
        }

        # Prompt when an existing installation is found and -Force not set
        $existingAddin = Join-Path $addinsDir $ADDIN_FILE
        if ((Test-Path $existingAddin) -and -not $ForceInstall) {
            Write-Warn "Revit $year — existing installation found"
            $choice = Read-Host "      [R]eplace  [S]kip  [A]bort"
            switch ($choice.Trim().ToUpper()) {
                'S' { $result.Error = 'Skipped (existing installation kept)'; return $result }
                'A' { throw 'Aborted by user' }
            }
        }

        # Download
        $zipPath = Join-Path $env:TEMP $asset.name
        Write-Step "Revit $year — downloading $($asset.name) ($([math]::Round($asset.size / 1MB, 1)) MB)..."
        Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $zipPath `
            -Headers @{ 'User-Agent' = 'mcp-revit-installer' }

        # Verify size
        $actual = (Get-Item $zipPath).Length
        if ($actual -ne $asset.size) {
            throw "Size mismatch: expected $($asset.size) bytes, got $actual"
        }

        # Extract
        if (-not (Test-Path $addinsDir)) {
            New-Item -ItemType Directory -Path $addinsDir -Force | Out-Null
        }
        Expand-Archive -Path $zipPath -DestinationPath $addinsDir -Force
        Remove-Item $zipPath -Force

        # Unblock all DLLs and EXEs
        Get-ChildItem -Path $addinsDir -Recurse -Include '*.dll', '*.exe' |
            ForEach-Object { Unblock-File -Path $_.FullName -ErrorAction SilentlyContinue }

        # Verify required files
        $addinPath = Join-Path $addinsDir $ADDIN_FILE
        $dllFound  = Get-ChildItem -Path $addinsDir -Recurse -Filter $PLUGIN_DLL `
            -ErrorAction SilentlyContinue | Select-Object -First 1

        if (-not (Test-Path $addinPath)) { throw ".addin manifest not found: $addinPath" }
        if (-not $dllFound)              { throw "$PLUGIN_DLL not found under $addinsDir" }

        $result.Success   = $true
        $result.AddinPath = $addinPath
        Write-OK "Revit $year — installed successfully"

    } catch {
        $result.Error = $_.Exception.Message
        Write-Err "Revit $year — $($result.Error)"
    }

    return $result
}

# ── Uninstall for one Revit version ──────────────────────────────────────────
function Uninstall-ForVersion {
    param($Version)
    $year      = $Version.Year
    $addinsDir = $Version.AddinsDir
    $addinPath = Join-Path $addinsDir $ADDIN_FILE

    if (-not (Test-Path $addinPath)) {
        Write-Warn "Revit $year — plugin not installed, skipping"
        return
    }

    Remove-Item $addinPath -Force -ErrorAction SilentlyContinue

    Get-ChildItem -Path $addinsDir -Directory -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'revit_mcp*' -or $_.Name -like 'mcp*' } |
        ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }

    Write-OK "Revit $year — uninstalled"
}

# ── Node.js check ─────────────────────────────────────────────────────────────
function Test-NodeJs {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Warn "Node.js not found in PATH — required for the MCP server."
        $open = Read-Host "      Open nodejs.org download page? [Y/N]"
        if ($open.Trim().ToUpper() -eq 'Y') { Start-Process 'https://nodejs.org/en/download' }
        return
    }
    try {
        $ver   = (& node --version 2>$null).TrimStart('v')
        $major = [int](($ver -split '\.')[0])
        if ($major -lt $MIN_NODE) {
            Write-Warn "Node.js $ver found but $MIN_NODE+ is required."
            $open = Read-Host "      Open nodejs.org download page? [Y/N]"
            if ($open.Trim().ToUpper() -eq 'Y') { Start-Process 'https://nodejs.org/en/download' }
        } else {
            Write-OK "Node.js $ver"
        }
    } catch {
        Write-Warn "Could not determine Node.js version."
    }
}

# ── Claude Desktop config ─────────────────────────────────────────────────────
function Update-ClaudeDesktopConfig {
    param([string[]]$InstalledYears)

    $configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
    if (-not (Test-Path $configPath)) { return }

    Write-Step "Claude Desktop config found"
    $update = Read-Host "      Update mcpServers entry for mcp-server-for-revit? [Y/N]"
    if ($update.Trim().ToUpper() -ne 'Y') { return }

    # Use newest installed year for the bundled server path
    $year     = ($InstalledYears | Sort-Object -Descending | Select-Object -First 1)
    $serverJs = "$env:APPDATA\Autodesk\Revit\Addins\$year\revit_mcp_plugin\Commands\RevitMCPCommandSet\server\build\index.js"
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue)?.Source
    $entry    = if ($nodePath) {
        [PSCustomObject]@{ command = $nodePath; args = @($serverJs) }
    } else {
        [PSCustomObject]@{ command = 'node'; args = @($serverJs) }
    }

    try {
        $raw    = Get-Content $configPath -Raw -ErrorAction Stop
        $config = if ($raw.Trim()) { $raw | ConvertFrom-Json } else { [PSCustomObject]@{} }

        if (-not $config.mcpServers) {
            $config | Add-Member -NotePropertyName 'mcpServers' -NotePropertyValue ([PSCustomObject]@{})
        }
        $config.mcpServers | Add-Member -NotePropertyName 'mcp-server-for-revit' `
            -NotePropertyValue $entry -Force

        $config | ConvertTo-Json -Depth 10 | Set-Content $configPath -Encoding UTF8
        Write-OK "Claude Desktop config updated — entry: mcp-server-for-revit"
    } catch {
        Write-Warn "Could not update Claude Desktop config: $($_.Exception.Message)"
    }
}

# ── Summary table ─────────────────────────────────────────────────────────────
function Write-Summary {
    param($Results)
    $h = '─' * 58
    Write-Host ""
    Write-Host "  ┌──────────────┬───────────┬$h┐" -ForegroundColor DarkGray
    Write-Host "  │ Version      │ Status    │ Detail                                                   │" -ForegroundColor DarkGray
    Write-Host "  ├──────────────┼───────────┼$h┤" -ForegroundColor DarkGray
    foreach ($r in $Results) {
        $statusText  = if ($r.Success) { 'OK' } else { 'FAILED' }
        $statusColor = if ($r.Success) { 'Green' } else { 'Red' }
        $detail      = if ($r.Success) { $r.AddinPath } else { $r.Error }
        if ($detail.Length -gt 56) { $detail = $detail.Substring(0, 53) + '...' }
        $vCol = "Revit $($r.Year)".PadRight(12)
        $sCol = $statusText.PadRight(9)
        $dCol = $detail.PadRight(56)
        Write-Host "  │ $vCol │ " -NoNewline -ForegroundColor DarkGray
        Write-Host $sCol -NoNewline -ForegroundColor $statusColor
        Write-Host " │ $dCol │" -ForegroundColor DarkGray
    }
    Write-Host "  └──────────────┴───────────┴$h┘" -ForegroundColor DarkGray
    Write-Host ""
}

# ════════════════════════════════════════════════════════════════
#  MAIN
# ════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    mcp-servers-for-revit  —  Universal Installer     " -ForegroundColor Cyan
Write-Host "    https://github.com/$REPO                          " -ForegroundColor DarkCyan
Write-Host "  ════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Detect Revit versions
$limit    = if ($RevitVersion) { @($RevitVersion) } else { @() }
$installs = Get-InstalledRevitVersions -Limit $limit

if ($installs.Count -eq 0) {
    Write-Err $(if ($RevitVersion) { "Revit $RevitVersion not detected on this machine." } else { "No Revit installation found (checked 2021-2027)." })
    Write-Info "Use -RevitVersion to override: .\install.ps1 -RevitVersion 2025"
    exit 1
}

Write-OK "Detected: Revit $($installs.Year -join ', ')"
Write-Host ""

# ── Uninstall path ───────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Step "Uninstalling from all detected versions..."
    foreach ($v in $installs) { Uninstall-ForVersion -Version $v }
    Write-Host ""
    Write-OK "Uninstall complete."
    exit 0
}

# ── Network check ────────────────────────────────────────────────────────────
Write-Step "Checking GitHub connectivity..."
try {
    $null = Invoke-WebRequest -Uri 'https://api.github.com' -Method Head `
        -Headers @{ 'User-Agent' = 'mcp-revit-installer' } -UseBasicParsing
} catch {
    Write-Err "Cannot reach api.github.com — check your connection or proxy."
    exit 1
}

# ── Fetch release ────────────────────────────────────────────────────────────
Write-Step "Fetching release ($Tag)..."
try {
    $release = Get-Release -Tag $Tag
} catch {
    Write-Err "Failed to fetch release: $($_.Exception.Message)"
    Write-Info "Available: https://github.com/$REPO/releases"
    exit 1
}
Write-OK "Release: $($release.tag_name) — $($release.assets.Count) assets"
Write-Host ""

# ── Install each version ─────────────────────────────────────────────────────
$results        = [System.Collections.Generic.List[PSCustomObject]]::new()
$installedYears = [System.Collections.Generic.List[string]]::new()

foreach ($v in $installs) {
    $r = Install-ForVersion -Version $v -Release $release -ForceInstall $Force.IsPresent
    $results.Add($r)
    if ($r.Success) { $installedYears.Add($v.Year.ToString()) }
}

# ── Node.js check ────────────────────────────────────────────────────────────
if (-not $SkipNodeCheck) {
    Write-Host ""
    Write-Step "Checking Node.js..."
    Test-NodeJs
}

# ── Claude Desktop config ─────────────────────────────────────────────────────
if (-not $SkipMcpConfig -and $installedYears.Count -gt 0) {
    Write-Host ""
    Update-ClaudeDesktopConfig -InstalledYears $installedYears
}

# ── Summary ──────────────────────────────────────────────────────────────────
Write-Summary -Results $results

$ok   = ($results | Where-Object { $_.Success }).Count
$fail = ($results | Where-Object { -not $_.Success }).Count

if ($fail -eq 0) {
    Write-OK "All $ok version(s) installed successfully."
} else {
    Write-Warn "$ok installed, $fail failed — see table above for details."
}

Write-Host ""
Write-Host "  Docs:   https://github.com/$REPO#readme"  -ForegroundColor DarkGray
Write-Host "  Issues: https://github.com/$REPO/issues"  -ForegroundColor DarkGray
Write-Host ""
