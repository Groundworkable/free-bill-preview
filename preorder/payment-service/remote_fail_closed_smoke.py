#!/usr/bin/env python3
"""Non-mutating, credential-free security smoke check for isolated Cloudflare payment Worker.

Sends only an unsigned JSON POST to the dedicated test Worker. Does not use a Stripe
API key or webhook secret; cannot produce any purchase or paid event. Expects
PAYMENTS_MODE=disabled, so the Worker must refuse before signature inspection.
Exit nonzero if it may be processing payments or the deployed version is wrong.
"""
import sys
import urllib.error
import urllib.request

DESTINATION = (
    "https://groundwork-payment-sandbox-isolated.groundworkbyable.workers.dev"
    "/webhooks/stripe"
)
EXPECTED_STATUS = 503
EXPECTED_BODY = "Payment receiver not configured"


def main() -> int:
    request = urllib.request.Request(
        DESTINATION,
        method="POST",
        data=b"{}",
        headers={
            "Content-Type": "application/json",
            "User-Agent": "GroundworkSandboxSafeGateCheck/1.0",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            code = response.status
            body = response.read(256).decode("utf-8", errors="replace").strip()
    except urllib.error.HTTPError as response:
        code = response.code
        body = response.read(256).decode("utf-8", errors="replace").strip()
    except (urllib.error.URLError, TimeoutError, OSError) as error:
        print(f"UNVERIFIED: isolated Worker could not be reached: {type(error).__name__}")
        return 1

    if code == EXPECTED_STATUS and body == EXPECTED_BODY:
        print("PASS: isolated deployed Worker is reachable and rejects payment requests while disabled")
        return 0

    print(f"UNSAFE OR UNVERIFIED: Worker returned HTTP {code} with an unexpected response")
    print("Do not enable Stripe webhook or payment links. Check the deployed Worker and gating variables.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
