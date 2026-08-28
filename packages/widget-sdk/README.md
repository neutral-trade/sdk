# @neutral-trade/widget-sdk

Host-side SDK for embedding the Neutral Trade widget in a partner site. The package mounts the hosted interface from `https://widget.neutral.trade`, bridges typed deposit and withdrawal requests to a Wallet Standard wallet, verifies the exact transaction bytes, submits the signed transaction, and tracks confirmation.

The iframe never receives wallet keys or an API key. Partners provide a public **builder code**, and attribution uses the ntbundle `setUserReferrer` instruction.

## Installation

```sh
npm install @neutral-trade/widget-sdk @solana/kit @wallet-standard/app
```

React is an optional peer dependency. Install React 18 or newer when using the React entry point.

The package requires Node 20 or newer for development and a browser at runtime.

The widget package version stays in lockstep with `@neutral-trade/sdk` so the repository's tagged release publishes both public packages together.

## Wallet setup

`createWalletStandardSigner` binds a registered Wallet Standard wallet and one of its connected accounts. The widget bridge calls the wallet's `solana:signTransaction` feature only after a typed operation passes verification.

```ts
import { createWalletStandardSigner } from '@neutral-trade/widget-sdk'
import { getWallets } from '@wallet-standard/app'

const wallet = getWallets().get()[0]
if (!wallet || !wallet.accounts[0])
  throw new Error('Connect a Wallet Standard wallet first')

const signer = createWalletStandardSigner(wallet, wallet.accounts[0])
```

Wallet connection remains the partner application's responsibility. See the [vanilla example](../../examples/widget-vanilla/src/main.ts) and [React example](../../examples/widget-react/src/main.tsx) for discovery and `standard:connect` handling.

## Vanilla usage

`mount` accepts an element or selector. Inline mode fills the host container. Floating mode renders a launcher and a dismissible panel.

```ts
import { mount } from '@neutral-trade/widget-sdk'

const widget = mount({
  element: '#neutral-trade',
  signer,
  builderCode: 'ACME',
  cluster: 'devnet',
  vaults: ['HXvKAH4QyYMe7MsxC88pb19MhhYCEDHai87E8tZkmXmB'],
  mode: 'inline',
  onEvent(event) {
    console.log(event)
  },
})

widget.close()
widget.open()
widget.destroy()
```

The default RPC endpoints are the public Solana mainnet and devnet endpoints. Pass `rpcUrl` for a dedicated endpoint, or pass a `WidgetTransactionTransport` implementation to control blockhash checks, submission, and confirmation tracking. `rpcUrl` and `transport` are mutually exclusive.

## React usage

The React component is isolated in the `./react` entry point so vanilla consumers do not need React.

```tsx
import { NeutralTradeWidget } from '@neutral-trade/widget-sdk/react'

<NeutralTradeWidget
  signer={signer}
  builderCode="ACME"
  cluster="mainnet"
  vaults={['BUNDLE_ADDRESS']}
  mode="floating"
  onEvent={handleWidgetEvent}
/>
```

Changing the signer or semantic configuration remounts the iframe. Equivalent `vaults` arrays and `verifierLimits` objects preserve the existing mount. A forwarded ref exposes the same `open`, `close`, and `destroy` controls as `mount`.

## Lifecycle events

`onEvent` receives a `NeutralTradeWidgetEvent` union. Operation events carry values decoded from the verified transaction bytes.

- `ready`
- `attribution-applied`
- `attribution-unavailable`
- `deposit-submitted`
- `deposit-confirmed`
- `withdraw-submitted`
- `withdraw-confirmed`
- `error`

`attribution-applied` is emitted only after the transaction containing `setUserReferrer` confirms. A deposit without a binding emits `attribution-unavailable` with a typed reason after submission.

## Transaction verification

`verifyWidgetTransaction` decodes the wire transaction and enforces these host-side invariants before the wallet prompt:

- The connected account is the fee payer and the only required signer.
- The single signature slot is zero-filled.
- Legacy and v0 transactions are accepted, but address lookup tables are rejected.
- Every static account is unique and referenced.
- Compute budget instructions may set one compute unit limit and one compute unit price before operation instructions. Host limits cap both values.
- Withdrawal transactions may create one correctly derived associated token account with the idempotent instruction.
- ntbundle instructions must target `getDefaultBundleProgramIdByCluster` for the configured cluster.
- Only `initializeBundleDepositor`, `setUserReferrer`, `requestDeposit`, and `requestWithdrawal` are accepted.
- The user, vault, operation, deposit amount, withdrawal shares amount, and referrer PDAs are re-derived from instruction accounts and instruction data.
- The configured transport must report the blockhash as valid.

The postMessage protocol has no generic transaction-signing request. A wallet-returned transaction is decoded again, and its message bytes must exactly match the verified message before submission.

## Hosted widget protocol

The hosted widget should import the shared schemas from `@neutral-trade/widget-sdk/protocol`:

```ts
import {
  hostToWidgetMessageSchema,
  parseWidgetToHostMessage,
  widgetToHostMessageSchema,
} from '@neutral-trade/widget-sdk/protocol'
```

Every message includes `protocol: "neutral-trade-widget"` and `version: 1`. Initialization follows this sequence:

Deposit amounts and withdrawal share amounts are unsigned decimal strings capped at 39 digits, the maximum decimal width needed for u128 fields.

- The host posts `host:hello` after the pinned iframe loads. It includes the supported versions, public builder code, cluster, vault allowlist, display mode, and connected wallet address.
- The iframe replies with `widget:ready` and its supported versions.
- Deposit and withdrawal requests are accepted only after the handshake.

The host processes a message only when `event.origin` equals `https://widget.neutral.trade` and `event.source` is the mounted iframe's `contentWindow`. Unknown versions and invalid envelopes receive `host:protocol-error` responses.

## Development

From the repository root:

```sh
pnpm --filter @neutral-trade/widget-sdk typecheck
pnpm --filter @neutral-trade/widget-sdk test
pnpm --filter @neutral-trade/widget-sdk build
```

The verifier tests generate valid wire transactions and adversarial mutations for extra instructions, swapped vaults, added signers, address lookup tables, wrong program IDs, tampered amounts, foreign fee payers, stale blockhashes, nonzero signature slots, and incorrect referrer PDAs. Protocol properties are exercised with `fast-check`.
