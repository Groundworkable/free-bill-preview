# TEST-ONLY, offline, read-only. Run only from the checked-out payment DRAFT branch.
# No Wrangler/Cloudflare, Stripe, Supabase, Resend, npm install, GitHub Actions,
# database mutation, secrets, OTP email, claim, membership, or deployment.
# Requires existing Node.js 22+. Optional -IncludeSqlite requires Python 3.
[CmdletBinding()]
param([switch]$IncludeSqlite)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$expectedFiles = @(
    'purchase_attestation_producer.draft.test.mjs',
    'purchase_attestation_transport.draft.test.mjs',
    'purchase_attestation_transport.integration.test.mjs',
    'private_attestation_entry.test.mjs',
    'private_attestation_config.test.mjs',
    'private_attestation_provisioned_config.test.mjs',
    'private_attestation_next_version_readiness.review.test.mjs',
    'private_attestation_next_version_confirmed_terms.review.test.mjs'
)

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'STOP: Node.js is not installed. Nothing was executed.'
}
$nodeVersion = (& node --version).Trim()
if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v(\d+)\.') {
    throw 'STOP: Cannot identify Node.js version.'
}
if ([int]$Matches[1] -lt 22) {
    throw 'STOP: Requires Node.js 22+ for the existing TEST-only mocks.'
}
foreach ($name in $expectedFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot $name) -PathType Leaf)) {
        throw "STOP: Missing draft local test file: $name. Download the entire PR branch first."
    }
}

Push-Location $PSScriptRoot
try {
    Write-Host "Running synthetic TEST-only Node suite using $nodeVersion; no provider credentials."
    & node --test @expectedFiles
    if ($LASTEXITCODE -ne 0) {
        throw "STOP: Local Node suite failed (exit code $LASTEXITCODE). No remote writes were attempted."
    }
    Write-Host 'PASS: All local Node synthetic verifier tests completed.'

    if ($IncludeSqlite) {
        $py = Get-Command py -ErrorAction SilentlyContinue
        if ($py) {
            & py -3 attestation_request_nonce_ledger.test.py
        } elseif (Get-Command python -ErrorAction SilentlyContinue) {
            & python attestation_request_nonce_ledger.test.py
        } else {
            throw 'STOP: Python 3 unavailable; optional local SQL nonce tests NOT run.'
        }
        if ($LASTEXITCODE -ne 0) {
            throw 'STOP: Local synthetic SQLite nonce tests failed. No remote database writes.'
        }
        Write-Host 'PASS: Local synthetic SQLite nonce tests completed.'
    }
    Write-Host 'NO CLOUD WRITE / NO OTP / NO STRIPE / NO MEMBERSHIP / NO DEPLOY.'
} finally {
    Pop-Location
}
