# Groundwork PRIVATE TEST verifier — OFFLINE BUILD INSPECTION ONLY.
# Zero Cloudflare requests, uploads, deployments, emails, Stripe calls or D1 writes.
# Uses pinned Wrangler 4.162.0 from the EXISTING npm cache. If unavailable STOP.
# Run only from the separately checked-out payment DRAFT branch.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$branch = (& git -C $repo branch --show-current).Trim()
if ($LASTEXITCODE -ne 0 -or $branch -ne 'site/prepurchase-checkout-gate-2026-11-13') {
    throw 'STOP: Not on exact payment TEST draft branch. No dry run attempted.'
}
$dirty = @(& git -C $repo status --porcelain)
if ($LASTEXITCODE -ne 0 -or ($dirty | Where-Object { $_ }).Count -gt 0) {
    throw 'STOP: Checkout contains local changes. Do not overwrite or run.'
}
$configPath = Join-Path $PSScriptRoot 'wrangler.private-attestation.next-version.REVIEW_ONLY_DO_NOT_DEPLOY.jsonc'
$entryPath = Join-Path $PSScriptRoot 'private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs'
if (-not (Test-Path -LiteralPath $configPath -PathType Leaf) -or
    -not (Test-Path -LiteralPath $entryPath -PathType Leaf)) {
    throw 'STOP: Missing exact reviewed config or entrypoint.'
}
$raw = Get-Content -LiteralPath $configPath -Raw
$withoutComments = (($raw -split "\r?\n") |
    Where-Object { $_ -notmatch '^\s*//' }) -join [Environment]::NewLine
$cfg = $withoutComments | ConvertFrom-Json
$expectedSecrets = @(
    'STRIPE_TEST_SECRET_KEY',
    'PURCHASE_ATTESTATION_ACCESS_AUD',
    'PURCHASE_ATTESTATION_INTERNAL_TOKEN',
    'PURCHASE_ATTESTATION_REQUEST_HMAC_SECRET',
    'INDEPENDENT_BUYER_PROOF_HMAC_SECRET',
    'PURCHASE_ATTESTATION_HMAC_SECRET',
    'PURCHASER_CONTACT_HMAC_SECRET'
)
$expectedModes = @(
    'PAYMENTS_MODE','PURCHASE_ATTESTATION_ENTRY_MODE',
    'PURCHASE_ATTESTATION_TRANSPORT_MODE','PURCHASE_ATTESTATION_MODE',
    'PURCHASE_ATTESTATION_REQUEST_AUTH_MODE','PURCHASE_ATTESTATION_REPLAY_MODE',
    'PURCHASE_ATTESTATION_ACCESS_MODE'
)
$required = @($cfg.secrets.required)
if ($cfg.name -ne 'groundwork-private-attestation-test' -or
    $cfg.main -ne './private_attestation_entry.DRAFT_DO_NOT_DEPLOY.mjs' -or
    $cfg.workers_dev -ne $true -or $cfg.preview_urls -ne $false -or
    @($cfg.routes).Count -ne 0 -or
    @($cfg.d1_databases).Count -ne 1 -or
    $cfg.d1_databases[0].binding -ne 'DB' -or
    $cfg.d1_databases[0].database_id -ne 'f37839b6-3ed4-4a73-89d7-b6cd6aef6125' -or
    $cfg.vars.PURCHASE_ATTESTATION_PRIVATE_ORIGIN -ne 'https://groundwork-private-attestation-test.groundworkbyable.workers.dev' -or
    @($required).Count -ne 7 -or
    (@(Compare-Object -ReferenceObject $expectedSecrets -DifferenceObject $required)).Count -ne 0) {
    throw 'STOP: Worker identity, D1, routing, origin or seven secret names drifted.'
}
foreach ($mode in $expectedModes) {
    if ($cfg.vars.$mode -ne 'disabled') { throw "STOP: $mode is not disabled." }
}
foreach ($name in $required) {
    if ($cfg.vars.PSObject.Properties.Name -contains $name) {
        throw "STOP: A secret name appears as a plaintext variable: $name"
    }
}
if ($cfg.vars.TERMS_VERSION -ne 'prepurchase-v2026-11-17' -or
    $cfg.vars.TERMS_APPROVED -ne 'true' -or
    $cfg.vars.MONTH_LINK_ID -ne 'plink_1UbK33JK9stEim4w7BvY2CnM' -or
    $cfg.vars.ANNUAL_LINK_ID -ne 'plink_1UbK3MJK9stEim4w2nS3loNW' -or
    $cfg.vars.MONTH_PRICE_ID -ne 'price_1UbK2YJK9stEim4wCsZ0tyao' -or
    $cfg.vars.ANNUAL_PRICE_ID -ne 'price_1UbK2aJK9stEim4wgnY5LRVR') {
    throw 'STOP: Verified historical TEST Terms/offer config changed.'
}
if (-not (Get-Command npx.cmd -ErrorAction SilentlyContinue)) {
    throw 'STOP: npx.cmd not available. Nothing executed.'
}
Write-Host 'PASS: Reviewed exact PRIVATE TEST identity, D1, Terms, offers, seven required secret names and seven OFF modes.'
$dir = Join-Path $env:TEMP ('groundwork-private-offline-bundle-' + [guid]::NewGuid().ToString('N'))
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$oldMetrics = $env:WRANGLER_SEND_METRICS
$oldTrack = $env:DO_NOT_TRACK
try {
    $env:WRANGLER_SEND_METRICS = 'false'
    $env:DO_NOT_TRACK = '1'
    Push-Location $PSScriptRoot
    try {
        # npm --offline forbids package download; Wrangler --dry-run performs
        # local compilation and skips the versions POST entirely.
        & npx.cmd --offline --yes wrangler@4.162.0 versions upload --dry-run --config $configPath --outdir $dir
        if ($LASTEXITCODE -ne 0) {
            throw 'STOP: Offline Wrangler dry-run failed. No remote upload was attempted. If Wrangler is not cached, do NOT replace --offline without a separate review.'
        }
    } finally {
        Pop-Location
    }
    $bundles = @(Get-ChildItem -LiteralPath $dir -Recurse -File -Filter '*.js')
    if ($bundles.Count -lt 1) {
        throw 'STOP: Wrangler reported success but no JavaScript bundle was found.'
    }
    $foundPrivate = $false
    $foundGate = $false
    foreach ($file in $bundles) {
        $body = Get-Content -LiteralPath $file.FullName -Raw
        if ($body.Contains('/internal/test-prepurchase-attestation')) { $foundPrivate = $true }
        if ($body.Contains('PURCHASE_ATTESTATION_ENTRY_MODE')) { $foundGate = $true }
    }
    if (-not $foundPrivate -or -not $foundGate) {
        throw 'STOP: Bundled code lacks expected private route or default-OFF entry gate.'
    }
    Write-Host "PASS: Offline Wrangler 4.162.0 bundle created ($($bundles.Count) JS file(s))."
    Write-Host 'PASS: Private attestation route and entry mode gate found in compiled output.'
    Write-Host 'NOT VERIFIED: Cloudflare secret values, Access policy, inactive-version ancestry or remote runtime.'
    Write-Host 'NO CLOUD WRITE / NO DEPLOY / NO OTP / NO STRIPE / NO MEMBERSHIP.'
} finally {
    $env:WRANGLER_SEND_METRICS = $oldMetrics
    $env:DO_NOT_TRACK = $oldTrack
    if (Test-Path -LiteralPath $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
}
