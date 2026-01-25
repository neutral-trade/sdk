import type { IdlAccounts } from '@coral-xyz/anchor'
import type { IdlAccounts as IdlAccounts32 } from '@coral-xyz/anchor-32'
import type { NtbundleV1 } from '../idl/bundle-v1'
import type { NtbundleV2 } from '../idl/bundle-v2'
import type { VaultId } from './vault-types'

// Derive types directly from IDL instead of from program variables
export type UserBundleAccount
  = | IdlAccounts<NtbundleV1>['userBundleAccount']
    | IdlAccounts32<NtbundleV2>['userBundleAccount']

export type UserBundleTempData
  = | IdlAccounts<NtbundleV1>['bundleTempData']
    | IdlAccounts32<NtbundleV2>['bundleTempData']

export type OracleData
  = | IdlAccounts<NtbundleV1>['oracleData']
    | IdlAccounts32<NtbundleV2>['oracleData']

export type BundleAccount
  = | IdlAccounts<NtbundleV1>['bundle']
    | IdlAccounts32<NtbundleV2>['bundle']

export type UserBundleAccountByVaultId = Record<VaultId, UserBundleAccount | null>
