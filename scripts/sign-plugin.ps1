<#
.SYNOPSIS
  Signs the Revit MCP plugin DLLs with a local self-signed code-signing certificate, so Revit's
  "Security - Unsigned Add-In" prompt stops appearing in unattended sessions.

.DESCRIPTION
  - Creates the certificate once in Cert:\CurrentUser\My (subject "CN=revit-mcp-server local build")
    and exports its public part to .signing\revit-mcp-local.cer (git-ignored).
  - Signs RevitMCPPlugin.dll (the assembly the .addin manifest names, which is the one Revit checks)
    and RevitMCPCommandSet.dll, in the build output and in the installed add-in folder.
  - Does NOT change machine trust, and does not sign until you have trusted the certificate (see
    INSTALLATION.md, "Signing the plugin"): Revit 2027 shows "Security - Invalid Signature" on every
    start for an untrusted signature. Once trusted, choose "Always Load" for the publisher once; it
    survives rebuilds because every build is signed with the same certificate.
  - Signing is optional. An unsigned build that was once set to "Always Load" kept loading silently
    after rebuilds in testing (2026-11-08), so most machines only ever see the unsigned prompt once.

  Run it after each build, or build with -p:SignPlugin=true to run it automatically.

.EXAMPLE
  pwsh -File scripts\sign-plugin.ps1 -RevitVersion 2027
#>
param(
    [string]$RevitVersion = "2027",
    [string]$Configuration = "Debug R$($RevitVersion.Substring(2))",
    [string]$Subject = "CN=revit-mcp-server local build",
    [switch]$Force   # sign even though the certificate is not trusted (for testing only)
)
$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot

# 1. The certificate (created once).
$cert = Get-ChildItem Cert:\CurrentUser\My -CodeSigningCert |
    Where-Object { $_.Subject -eq $Subject -and $_.NotAfter -gt (Get-Date) } |
    Sort-Object NotAfter -Descending | Select-Object -First 1
if (-not $cert) {
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject $Subject `
        -CertStoreLocation Cert:\CurrentUser\My -KeyUsage DigitalSignature `
        -KeyAlgorithm RSA -KeyLength 3072 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(5)
    Write-Host "Created code-signing certificate $($cert.Thumbprint) ($Subject)"
}
$cerDir = Join-Path $repo ".signing"
New-Item -ItemType Directory -Force $cerDir | Out-Null
$cerPath = Join-Path $cerDir "revit-mcp-local.cer"
Export-Certificate -Cert $cert -FilePath $cerPath -Force | Out-Null

# 2. The files to sign.
$installed = Join-Path $env:APPDATA "Autodesk\Revit\Addins\$RevitVersion\revit_mcp_plugin"
$candidates = @(
    (Join-Path $repo "plugin\bin\AddIn $RevitVersion $Configuration\revit_mcp_plugin\RevitMCPPlugin.dll"),
    (Join-Path $installed "RevitMCPPlugin.dll"),
    (Join-Path $installed "Commands\RevitMCPCommandSet\$RevitVersion\RevitMCPCommandSet.dll")
)
$files = $candidates | Where-Object { Test-Path $_ }
if (-not $files) { throw "No plugin DLLs found for Revit $RevitVersion ($Configuration). Build first." }

# 3. Refuse to sign with an untrusted certificate: Revit 2027 then shows "Security - Invalid Signature"
#    on EVERY start, which is worse than unsigned (an unsigned add-in can be set to "Always Load" once).
$trusted = (Test-Path "Cert:\CurrentUser\TrustedPublisher\$($cert.Thumbprint)") -and
           (Test-Path "Cert:\CurrentUser\Root\$($cert.Thumbprint)")
if (-not $trusted -and -not $Force) {
    Write-Host "Not signing: certificate $($cert.Thumbprint) is not trusted on this account yet."
    Write-Host "An untrusted signature makes Revit show 'Security - Invalid Signature' on every start."
    Write-Host "To trust it (once, your call), then rerun this script:"
    Write-Host "  Import-Certificate -FilePath `"$cerPath`" -CertStoreLocation Cert:\CurrentUser\Root"
    Write-Host "  Import-Certificate -FilePath `"$cerPath`" -CertStoreLocation Cert:\CurrentUser\TrustedPublisher"
    Write-Host "(Windows asks you to confirm the Root import.) Then start Revit once and choose 'Always Load'."
    exit 0
}

foreach ($f in $files) {
    $r = Set-AuthenticodeSignature -FilePath $f -Certificate $cert -HashAlgorithm SHA256
    Write-Host ("{0,-14} {1}" -f $r.Status, $f)
}
