import type { IdlAccounts } from '@coral-xyz/anchor'
import type { Ntbundle } from '../idl/ntbundle'

// Derive types directly from single ntbundle IDL source.
export type UserBundleAccount = IdlAccounts<Ntbundle>['userBundleAccount']

export type UserBundleTempData = IdlAccounts<Ntbundle>['bundleTempData']

export type OracleData = IdlAccounts<Ntbundle>['oracleData']

export type BundleAccount = IdlAccounts<Ntbundle>['bundle']

export type UserBundleAccountByVaultId = Record<number, UserBundleAccount | null>
