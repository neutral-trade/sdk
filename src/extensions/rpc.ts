import type {
  GetAccountInfoApi,
  GetMultipleAccountsApi,
  GetProgramAccountsApi,
  Rpc,
} from "@solana/kit";

export type GetAccountInfoRpc = Rpc<GetAccountInfoApi>;
export type GetMultipleAccountsRpc = Rpc<GetMultipleAccountsApi>;
export type GetProgramAccountsRpc = Rpc<GetProgramAccountsApi>;

/**
 * Combined RPC interface used by the higher-level extension helpers.
 * The generated single-account fetchers use `getAccountInfo`; the generated
 * batch fetchers (`fetchAllMaybe*`) use `getMultipleAccounts`.
 */
export type ExtensionsRpc = Rpc<GetAccountInfoApi & GetMultipleAccountsApi>;
