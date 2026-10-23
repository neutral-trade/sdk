# Changelog

## 2.3.0

- Accept one trailing, accountless `NT_REF=v1|op=register|ref=<applied referrer>` points memo on attributed deposits. Reject different referrers, extra data, accounts, duplicates, misplaced memos, and memos on withdrawals or unattributed deposits.
- Add protocol v3 theme tokens, mount-time validation, themed host chrome, confirmed v1/v2 fallback negotiation with timeout retry, and stable React theme snapshots.
- Add raw `builderAddress` attribution with protocol v2, strict mount-time XOR validation, exact referrer verification, v1 `builderCode` compatibility, and React remount semantics.
- Bound operation amount strings to the u128 decimal width and preserve React mounts across equivalent callback, vault, and verifier-limit prop identities.
- Add inline and floating iframe mounting pinned to `https://widget.neutral.trade`.
- Add the optional React entry point.
- Add the version 1 postMessage schemas and strict origin and source checks.
- Add Wallet Standard signing for typed deposit and withdrawal operations.
- Add wire-byte transaction verification, RPC submission, confirmation tracking, and lifecycle events.
