import { address, createSolanaRpc } from '@solana/kit'
import { fetchBundle, getVaultById } from '../src'

async function main(): Promise<void> {
  const vault = getVaultById(48)
  if (!vault) {
    throw new Error('Vault 48 is not present in the mainnet registry')
  }

  const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com')
  await fetchBundle(rpc, address(vault.vaultAddress))
}

void main()
