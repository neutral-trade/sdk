/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/ntbundle.json`.
 */
export interface NtbundleV2 {
  address: 'BUNDeH5A4c47bcEoAjBhN3sCjLgYnRsmt9ibMztqVkC9'
  metadata: {
    name: 'ntbundle'
    version: '0.1.0'
    spec: '0.1.0'
    description: 'Created with Anchor'
  }
  instructions: [
    {
      name: 'addStrategy'
      discriminator: [
        64,
        123,
        127,
        227,
        192,
        234,
        198,
        20,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'receiverAddress'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'allocationBps'
          type: 'u32'
        },
      ]
    },
    {
      name: 'applyFeesToUser'
      discriminator: [
        26,
        41,
        103,
        167,
        61,
        147,
        141,
        30,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccountOwner'
          writable: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'userBundleAccountOwner'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'changeBundleMasterAdmin'
      discriminator: [
        255,
        41,
        246,
        82,
        7,
        81,
        174,
        112,
      ]
      accounts: [
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'bundleMasterAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  77,
                  65,
                  83,
                  84,
                  69,
                  82,
                ]
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'newAdmin'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'changeManager'
      discriminator: [
        97,
        44,
        74,
        213,
        119,
        243,
        203,
        8,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'newManager'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'closeUserBundleAccount'
      discriminator: [
        201,
        195,
        126,
        228,
        9,
        173,
        79,
        215,
      ]
      accounts: [
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'authority'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
        },
      ]
      args: []
    },
    {
      name: 'distributeToReceivers'
      discriminator: [
        123,
        169,
        151,
        143,
        0,
        82,
        209,
        145,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'receiverAddress'
          writable: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'receiverAta'
          writable: true
        },
        {
          name: 'assetAddress'
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'enableStrategy'
      discriminator: [
        245,
        37,
        61,
        122,
        99,
        92,
        182,
        30,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'receiverAddress'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'endDistribution'
      discriminator: [
        201,
        74,
        167,
        103,
        102,
        125,
        0,
        236,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'initializeBundle'
      discriminator: [
        93,
        76,
        148,
        51,
        99,
        41,
        179,
        234,
      ]
      accounts: [
        {
          name: 'creator'
          writable: true
          signer: true
        },
        {
          name: 'bundleCreatorAccount'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  67,
                  82,
                  69,
                  65,
                  84,
                  79,
                  82,
                ]
              },
              {
                kind: 'account'
                path: 'creator'
              },
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'treasuryAccount'
          writable: true
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'bundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'arg'
                path: 'name'
              },
            ]
          }
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'name'
          type: {
            array: [
              'u8',
              32,
            ]
          }
        },
        {
          name: 'keeper'
          type: 'pubkey'
        },
        {
          name: 'depositFee'
          type: 'u32'
        },
        {
          name: 'withdrawalFee'
          type: 'u32'
        },
        {
          name: 'performanceFee'
          type: 'u32'
        },
        {
          name: 'managementFeeBps'
          type: 'u32'
        },
        {
          name: 'oracleBuffer'
          type: 'u64'
        },
        {
          name: 'maxDepositAmount'
          type: 'u64'
        },
        {
          name: 'minDepositAmount'
          type: 'u64'
        },
        {
          name: 'withdrawalDelay'
          type: 'u64'
        },
        {
          name: 'withdrawalTMin'
          type: 'i64'
        },
        {
          name: 'withdrawalTMax'
          type: 'i64'
        },
        {
          name: 'withdrawalCurve'
          type: 'f32'
        },
        {
          name: 'oracleMaxAge'
          type: 'i64'
        },
        {
          name: 'oracleUpdateTimeLimit'
          type: 'i64'
        },
        {
          name: 'permissionned'
          type: 'bool'
        },
      ]
    },
    {
      name: 'initializeBundleDepositor'
      discriminator: [
        126,
        6,
        242,
        36,
        22,
        209,
        35,
        2,
      ]
      accounts: [
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'authority'
          writable: true
          signer: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'userBundleAccount'
          docs: [
            'each user gets one UserBundleAccount account; it will be created if it doesn\'t exist.',
          ]
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'authority'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'initializeBundleMasterAccount'
      discriminator: [
        125,
        166,
        190,
        35,
        73,
        169,
        140,
        206,
      ]
      accounts: [
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'bundleMasterAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  77,
                  65,
                  83,
                  84,
                  69,
                  82,
                ]
              },
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'initializePermissionedBundleDepositor'
      discriminator: [
        157,
        162,
        213,
        42,
        205,
        201,
        37,
        255,
      ]
      accounts: [
        {
          name: 'payer'
          writable: true
          signer: true
        },
        {
          name: 'authority'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'userBundleAccount'
          docs: [
            'each user gets one UserBundleAccount account; it will be created if it doesn\'t exist.',
          ]
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'authority'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'managerWithdraw'
      discriminator: [
        201,
        248,
        190,
        143,
        86,
        43,
        183,
        254,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'managerTokenAccount'
          writable: true
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
      ]
      args: []
    },
    {
      name: 'netPendingTransactions'
      discriminator: [
        44,
        219,
        50,
        19,
        246,
        252,
        37,
        163,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'pendingDepositTokenAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'pendingBundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'pendingBundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  80,
                  69,
                  78,
                  68,
                  73,
                  78,
                  71,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
      ]
      args: []
    },
    {
      name: 'pauseDepositsWithdrawals'
      discriminator: [
        106,
        171,
        198,
        31,
        183,
        219,
        159,
        80,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'pause'
          type: 'bool'
        },
      ]
    },
    {
      name: 'performRefill'
      discriminator: [
        241,
        64,
        6,
        52,
        58,
        169,
        15,
        12,
      ]
      accounts: [
        {
          name: 'receiverAddress'
          writable: true
          signer: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'receiverAta'
          writable: true
        },
        {
          name: 'assetAddress'
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
      ]
      args: [
        {
          name: 'refillAmount'
          type: 'u64'
        },
      ]
    },
    {
      name: 'processDeposit'
      discriminator: [
        136,
        162,
        64,
        35,
        84,
        200,
        254,
        136,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'userBundleAccountOwner'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'pendingDepositTokenAccount'
          docs: [
            'the account holding the user\'s deposited asset before allocation.',
          ]
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'pendingBundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'userBundleAccountOwner'
          docs: [
            'the owner of the pending request (for event purposes).',
          ]
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'pendingBundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  80,
                  69,
                  78,
                  68,
                  73,
                  78,
                  71,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'processWithdrawal'
      discriminator: [
        51,
        97,
        236,
        17,
        37,
        33,
        196,
        64,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccountOwner'
        },
        {
          name: 'userTokenAccount'
          writable: true
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'pendingBundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  80,
                  69,
                  78,
                  68,
                  73,
                  78,
                  71,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'userBundleAccountOwner'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'treasuryAccount'
          writable: true
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'refundDeposit'
      discriminator: [
        19,
        19,
        78,
        50,
        187,
        10,
        162,
        229,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'userBundleAccountOwner'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'userBundleAccountOwner'
          docs: [
            'the owner of the pending request (for event purposes).',
          ]
        },
        {
          name: 'userTokenAccount'
          writable: true
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'bundleAssetAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'bundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'bundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'removeStrategy'
      discriminator: [
        185,
        238,
        33,
        91,
        134,
        210,
        97,
        26,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'receiverAddress'
          writable: true
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: []
    },
    {
      name: 'requestDeposit'
      discriminator: [
        243,
        202,
        197,
        215,
        135,
        97,
        213,
        109,
      ]
      accounts: [
        {
          name: 'user'
          writable: true
          signer: true
        },
        {
          name: 'userTokenAccount'
          docs: [
            'user token account (source of funds)',
          ]
          writable: true
        },
        {
          name: 'pendingDepositTokenAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'account'
                path: 'pendingBundleAssetAuthority'
              },
              {
                kind: 'const'
                value: [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169,
                ]
              },
              {
                kind: 'account'
                path: 'assetAddress'
              },
            ]
            program: {
              kind: 'const'
              value: [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89,
              ]
            }
          }
        },
        {
          name: 'treasuryAccount'
          writable: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'user'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'assetAddress'
          writable: true
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'pendingBundleAssetAuthority'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  80,
                  69,
                  78,
                  68,
                  73,
                  78,
                  71,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  65,
                  83,
                  83,
                  69,
                  84,
                  95,
                  65,
                  85,
                  84,
                  72,
                  79,
                  82,
                  73,
                  84,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'amount'
          type: 'u64'
        },
      ]
    },
    {
      name: 'requestWithdrawal'
      discriminator: [
        251,
        85,
        121,
        205,
        56,
        201,
        12,
        177,
      ]
      accounts: [
        {
          name: 'user'
          writable: true
          signer: true
        },
        {
          name: 'userBundleAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  85,
                  83,
                  69,
                  82,
                  95,
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'user'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'tokenProgram'
          address: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
        {
          name: 'rent'
          address: 'SysvarRent111111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'sharesAmount'
          type: 'u128'
        },
      ]
    },
    {
      name: 'setBundleCreator'
      discriminator: [
        190,
        144,
        93,
        89,
        14,
        138,
        195,
        166,
      ]
      accounts: [
        {
          name: 'admin'
          writable: true
          signer: true
        },
        {
          name: 'bundleMasterAccount'
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  77,
                  65,
                  83,
                  84,
                  69,
                  82,
                ]
              },
            ]
          }
        },
        {
          name: 'creator'
          docs: [
            'CHECK safe as only the pubkey is read',
          ]
        },
        {
          name: 'bundleCreatorAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  67,
                  82,
                  69,
                  65,
                  84,
                  79,
                  82,
                ]
              },
              {
                kind: 'account'
                path: 'creator'
              },
            ]
          }
        },
        {
          name: 'systemProgram'
          address: '11111111111111111111111111111111'
        },
      ]
      args: [
        {
          name: 'allowed'
          type: 'bool'
        },
      ]
    },
    {
      name: 'setDelays'
      discriminator: [
        18,
        56,
        143,
        125,
        147,
        15,
        199,
        108,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'withdrawalDelay'
          type: 'u64'
        },
        {
          name: 'withdrawalTMin'
          type: 'i64'
        },
        {
          name: 'withdrawalTMax'
          type: 'i64'
        },
        {
          name: 'withdrawalCurve'
          type: 'f32'
        },
      ]
    },
    {
      name: 'setFees'
      discriminator: [
        137,
        178,
        49,
        58,
        0,
        245,
        242,
        190,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'treasury'
          type: 'pubkey'
        },
        {
          name: 'depositFee'
          type: 'u32'
        },
        {
          name: 'withdrawalFee'
          type: 'u32'
        },
        {
          name: 'performanceFee'
          type: 'u32'
        },
        {
          name: 'managementFeeBps'
          type: 'u32'
        },
      ]
    },
    {
      name: 'setKeeper'
      discriminator: [
        102,
        94,
        23,
        78,
        157,
        222,
        243,
        214,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'newkeeper'
          type: 'pubkey'
        },
      ]
    },
    {
      name: 'setMaxDepositAmount'
      discriminator: [
        29,
        66,
        217,
        12,
        80,
        248,
        214,
        9,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'maxDepositAmount'
          type: 'u64'
        },
      ]
    },
    {
      name: 'setMinDepositAmount'
      discriminator: [
        224,
        153,
        215,
        211,
        233,
        14,
        124,
        128,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'minDepositAmount'
          type: 'u64'
        },
      ]
    },
    {
      name: 'setOracleBuffer'
      discriminator: [
        7,
        196,
        14,
        82,
        110,
        244,
        46,
        33,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'oracleBuffer'
          type: 'u64'
        },
      ]
    },
    {
      name: 'setOracleMaxAge'
      discriminator: [
        75,
        127,
        254,
        84,
        122,
        23,
        122,
        82,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'oracleMaxAge'
          type: 'i64'
        },
      ]
    },
    {
      name: 'setOracleUpdateTimeLimit'
      discriminator: [
        114,
        2,
        35,
        146,
        19,
        99,
        67,
        202,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
      ]
      args: [
        {
          name: 'oracleUpdateTimeLimit'
          type: 'i64'
        },
      ]
    },
    {
      name: 'startDistribution'
      discriminator: [
        118,
        230,
        215,
        75,
        83,
        2,
        163,
        35,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: []
    },
    {
      name: 'updateAllocations'
      discriminator: [
        229,
        242,
        146,
        124,
        44,
        15,
        130,
        95,
      ]
      accounts: [
        {
          name: 'manager'
          writable: true
          signer: true
        },
        {
          name: 'receiverAddress'
          writable: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'strategyAccount'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  83,
                  84,
                  82,
                  65,
                  84,
                  69,
                  71,
                  89,
                ]
              },
              {
                kind: 'account'
                path: 'receiverAddress'
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'newAllocationBps'
          type: 'u32'
        },
      ]
    },
    {
      name: 'updateOracle'
      discriminator: [
        112,
        41,
        209,
        18,
        248,
        226,
        252,
        188,
      ]
      accounts: [
        {
          name: 'keeper'
          writable: true
          signer: true
        },
        {
          name: 'bundleAccount'
          writable: true
        },
        {
          name: 'bundleTempData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  66,
                  85,
                  78,
                  68,
                  76,
                  69,
                  95,
                  84,
                  69,
                  77,
                  80,
                  95,
                  68,
                  65,
                  84,
                  65,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
        {
          name: 'oracleData'
          writable: true
          pda: {
            seeds: [
              {
                kind: 'const'
                value: [
                  79,
                  82,
                  65,
                  67,
                  76,
                  69,
                ]
              },
              {
                kind: 'account'
                path: 'bundleAccount'
              },
            ]
          }
        },
      ]
      args: [
        {
          name: 'newEquity'
          type: 'u64'
        },
      ]
    },
  ]
  accounts: [
    {
      name: 'bundle'
      discriminator: [
        15,
        82,
        167,
        230,
        37,
        214,
        82,
        80,
      ]
    },
    {
      name: 'bundleCreatorAccount'
      discriminator: [
        210,
        168,
        93,
        196,
        184,
        35,
        210,
        101,
      ]
    },
    {
      name: 'bundleMasterAccount'
      discriminator: [
        252,
        50,
        148,
        252,
        178,
        231,
        4,
        149,
      ]
    },
    {
      name: 'bundleTempData'
      discriminator: [
        3,
        137,
        171,
        33,
        191,
        15,
        54,
        4,
      ]
    },
    {
      name: 'oracleData'
      discriminator: [
        26,
        131,
        25,
        110,
        6,
        141,
        10,
        37,
      ]
    },
    {
      name: 'strategy'
      discriminator: [
        174,
        110,
        39,
        119,
        82,
        106,
        169,
        102,
      ]
    },
    {
      name: 'userBundleAccount'
      discriminator: [
        32,
        181,
        106,
        26,
        67,
        130,
        185,
        241,
      ]
    },
  ]
  events: [
    {
      name: 'allocated'
      discriminator: [
        146,
        11,
        194,
        76,
        4,
        220,
        226,
        43,
      ]
    },
    {
      name: 'allocationsUpdated'
      discriminator: [
        97,
        171,
        21,
        101,
        243,
        48,
        182,
        32,
      ]
    },
    {
      name: 'assignedProfitShare'
      discriminator: [
        13,
        208,
        181,
        192,
        192,
        238,
        120,
        197,
      ]
    },
    {
      name: 'authorizedReceiverAdded'
      discriminator: [
        185,
        19,
        240,
        219,
        194,
        25,
        19,
        234,
      ]
    },
    {
      name: 'authorizedReceiverRemoved'
      discriminator: [
        69,
        73,
        150,
        51,
        198,
        98,
        43,
        0,
      ]
    },
    {
      name: 'bundleCreatorAccountChanged'
      discriminator: [
        82,
        51,
        169,
        242,
        101,
        205,
        39,
        52,
      ]
    },
    {
      name: 'bundleDepositorInitialized'
      discriminator: [
        136,
        231,
        96,
        201,
        187,
        244,
        121,
        42,
      ]
    },
    {
      name: 'bundleMasterAccountInitialized'
      discriminator: [
        238,
        211,
        137,
        135,
        255,
        239,
        90,
        91,
      ]
    },
    {
      name: 'bundleMasterAdminChanged'
      discriminator: [
        220,
        192,
        90,
        93,
        19,
        132,
        73,
        208,
      ]
    },
    {
      name: 'changedCoreParams'
      discriminator: [
        156,
        119,
        46,
        221,
        22,
        121,
        186,
        53,
      ]
    },
    {
      name: 'chargedFeesToUser'
      discriminator: [
        201,
        63,
        172,
        93,
        230,
        105,
        127,
        255,
      ]
    },
    {
      name: 'delaysSet'
      discriminator: [
        241,
        35,
        245,
        242,
        188,
        53,
        99,
        208,
      ]
    },
    {
      name: 'depositRequested'
      discriminator: [
        35,
        33,
        229,
        138,
        116,
        238,
        192,
        22,
      ]
    },
    {
      name: 'depositedToDriftVault'
      discriminator: [
        200,
        86,
        135,
        159,
        147,
        246,
        123,
        85,
      ]
    },
    {
      name: 'distributedToReceivers'
      discriminator: [
        204,
        43,
        29,
        187,
        40,
        60,
        126,
        14,
      ]
    },
    {
      name: 'distributionEnded'
      discriminator: [
        21,
        180,
        83,
        66,
        101,
        235,
        108,
        208,
      ]
    },
    {
      name: 'distributionStarted'
      discriminator: [
        148,
        231,
        87,
        211,
        194,
        167,
        104,
        6,
      ]
    },
    {
      name: 'dustSharesBurned'
      discriminator: [
        166,
        218,
        110,
        236,
        33,
        135,
        162,
        139,
      ]
    },
    {
      name: 'initializedNewVaultDepositor'
      discriminator: [
        16,
        182,
        169,
        250,
        42,
        81,
        202,
        173,
      ]
    },
    {
      name: 'initializedReceivers'
      discriminator: [
        52,
        175,
        118,
        72,
        108,
        236,
        162,
        134,
      ]
    },
    {
      name: 'initializedVault'
      discriminator: [
        123,
        23,
        51,
        180,
        138,
        156,
        172,
        91,
      ]
    },
    {
      name: 'managerWithdrawal'
      discriminator: [
        167,
        6,
        24,
        193,
        128,
        74,
        94,
        207,
      ]
    },
    {
      name: 'maxDepositAmountSet'
      discriminator: [
        204,
        243,
        42,
        160,
        116,
        144,
        207,
        38,
      ]
    },
    {
      name: 'minDepositAmountSet'
      discriminator: [
        143,
        114,
        126,
        18,
        32,
        207,
        22,
        19,
      ]
    },
    {
      name: 'nettingCompleted'
      discriminator: [
        176,
        162,
        4,
        24,
        91,
        47,
        115,
        81,
      ]
    },
    {
      name: 'newKeeperSet'
      discriminator: [
        33,
        68,
        171,
        11,
        43,
        129,
        192,
        45,
      ]
    },
    {
      name: 'newManagerSet'
      discriminator: [
        215,
        213,
        93,
        251,
        202,
        98,
        253,
        29,
      ]
    },
    {
      name: 'oracleBufferSet'
      discriminator: [
        188,
        151,
        124,
        251,
        253,
        205,
        187,
        32,
      ]
    },
    {
      name: 'oracleMaxAgeSet'
      discriminator: [
        51,
        17,
        80,
        99,
        8,
        112,
        166,
        44,
      ]
    },
    {
      name: 'oracleUpdateTimeLimitSet'
      discriminator: [
        196,
        182,
        75,
        225,
        80,
        5,
        111,
        103,
      ]
    },
    {
      name: 'oracleUpdated'
      discriminator: [
        138,
        9,
        51,
        219,
        228,
        198,
        11,
        147,
      ]
    },
    {
      name: 'pausedDepositsWithdrawals'
      discriminator: [
        131,
        139,
        248,
        233,
        29,
        255,
        148,
        98,
      ]
    },
    {
      name: 'redeemed'
      discriminator: [
        14,
        29,
        183,
        71,
        31,
        165,
        107,
        38,
      ]
    },
    {
      name: 'refilled'
      discriminator: [
        103,
        127,
        43,
        0,
        232,
        50,
        198,
        85,
      ]
    },
    {
      name: 'refundedDeposit'
      discriminator: [
        193,
        61,
        203,
        180,
        250,
        38,
        151,
        31,
      ]
    },
    {
      name: 'requestedWithdrawalToDriftVault'
      discriminator: [
        143,
        146,
        104,
        155,
        23,
        243,
        14,
        231,
      ]
    },
    {
      name: 'strategyAdded'
      discriminator: [
        248,
        59,
        8,
        90,
        242,
        168,
        247,
        204,
      ]
    },
    {
      name: 'strategyEnabled'
      discriminator: [
        105,
        24,
        77,
        30,
        163,
        227,
        107,
        102,
      ]
    },
    {
      name: 'strategyRemoved'
      discriminator: [
        118,
        162,
        92,
        185,
        73,
        29,
        245,
        144,
      ]
    },
    {
      name: 'userBundleAccountClosed'
      discriminator: [
        111,
        102,
        134,
        54,
        238,
        23,
        157,
        183,
      ]
    },
    {
      name: 'vaultNeutralFeeIncrementerSet'
      discriminator: [
        7,
        53,
        169,
        104,
        118,
        22,
        134,
        207,
      ]
    },
    {
      name: 'withdrawalRequested'
      discriminator: [
        75,
        207,
        21,
        12,
        160,
        102,
        150,
        55,
      ]
    },
    {
      name: 'withdrawnFromDriftVault'
      discriminator: [
        249,
        177,
        58,
        24,
        88,
        115,
        105,
        193,
      ]
    },
  ]
  errors: [
    {
      code: 6000
      name: 'insufficientFunds'
      msg: 'Insufficient funds to process withdrawal'
    },
    {
      code: 6001
      name: 'allocationAmountZero'
      msg: 'Allocation amount must be > 0'
    },
    {
      code: 6002
      name: 'redemptionAmountExceeded'
      msg: 'Redemption exceeds bundle balance'
    },
    {
      code: 6003
      name: 'refillAmountInvalid'
      msg: 'Refill amount must be > 0'
    },
    {
      code: 6004
      name: 'unauthorizedKeeperAction'
      msg: 'Not bundle keeper'
    },
    {
      code: 6005
      name: 'unauthorizedManagerAction'
      msg: 'Not bundle manager'
    },
    {
      code: 6006
      name: 'unauthorizedAdminAction'
      msg: 'Not bundle admin'
    },
    {
      code: 6007
      name: 'unauthorizedBundleCreator'
      msg: 'Not whitelisted bundle creator'
    },
    {
      code: 6008
      name: 'callerNotNeutralFeeIncrementer'
      msg: 'Not neutral fee incrementer'
    },
    {
      code: 6009
      name: 'amountMustBeBelowMax'
      msg: 'Amount above max limit'
    },
    {
      code: 6010
      name: 'invalidNeutralFeeIncrementer'
      msg: 'Invalid fee incrementer'
    },
    {
      code: 6011
      name: 'invalidReceiver'
      msg: 'Invalid receiver address'
    },
    {
      code: 6012
      name: 'mathError'
      msg: 'Math error'
    },
    {
      code: 6013
      name: 'invalidAllocations'
      msg: 'Invalid allocations'
    },
    {
      code: 6014
      name: 'mustBeInWhitelist'
      msg: 'Not in whitelist'
    },
    {
      code: 6015
      name: 'distributionAlreadyStarted'
      msg: 'Distribution already started'
    },
    {
      code: 6016
      name: 'distributionNotStarted'
      msg: 'Distribution not started'
    },
    {
      code: 6017
      name: 'leftToDistributeNotZero'
      msg: 'Distribution amount not zero'
    },
    {
      code: 6018
      name: 'receiverAlreadyAllocated'
      msg: 'Receiver already allocated'
    },
    {
      code: 6019
      name: 'rawTransferReceiver'
      msg: 'Not a raw transfer receiver'
    },
    {
      code: 6020
      name: 'invalidTwapPeriod'
      msg: 'Invalid twap period'
    },
    {
      code: 6021
      name: 'refillAmountExceeded'
      msg: 'Refill amount exceeded'
    },
    {
      code: 6022
      name: 'podTokenTotalSupplyZero'
      msg: 'Pod token total supply is zero'
    },
    {
      code: 6023
      name: 'allocationBpsGreaterThanGlobalAllocationBps'
      msg: 'Allocation bps greater than global allocation bps'
    },
    {
      code: 6024
      name: 'equityOutOfBufferBound'
      msg: 'Equity out of buffer bound'
    },
    {
      code: 6025
      name: 'redemptionAmountZero'
      msg: 'Redemption amount must be > 0'
    },
    {
      code: 6026
      name: 'pendingDepositExists'
      msg: 'Pending deposit exists'
    },
    {
      code: 6027
      name: 'insufficientSharesBalance'
      msg: 'Insufficient Shares balance'
    },
    {
      code: 6028
      name: 'pendingWithdrawalExists'
      msg: 'Pending withdrawal exists'
    },
    {
      code: 6029
      name: 'pendingDepositOrWithdrawalExists'
      msg: 'Pending deposit or withdrawal exists'
    },
    {
      code: 6030
      name: 'noPendingWithdrawal'
      msg: 'No pending withdrawal'
    },
    {
      code: 6031
      name: 'withdrawalAlreadyProcessed'
      msg: 'Withdrawal already processed'
    },
    {
      code: 6032
      name: 'pendingDepositAmountZero'
      msg: 'Pending deposit amount is zero'
    },
    {
      code: 6033
      name: 'insufficientBundleBalance'
      msg: 'Insufficient bundle balance'
    },
    {
      code: 6034
      name: 'noPendingTransactions'
      msg: 'No pending transactions'
    },
    {
      code: 6035
      name: 'depositsExtraInPendingsNotZero'
      msg: 'Deposits extra in pendings not zero'
    },
    {
      code: 6036
      name: 'pendingTransactionsExist'
      msg: 'Pending transactions exist'
    },
    {
      code: 6037
      name: 'managerSharesZero'
      msg: 'Manager shares is zero'
    },
    {
      code: 6038
      name: 'pausedDepositsWithdrawals'
      msg: 'Paused deposits withdrawals'
    },
    {
      code: 6039
      name: 'unpausedDepositsWithdrawals'
      msg: 'Unpaused deposits withdrawals'
    },
    {
      code: 6040
      name: 'nettingNotDone'
      msg: 'Netting not done'
    },
    {
      code: 6041
      name: 'nettingAlreadyDone'
      msg: 'Netting already done'
    },
    {
      code: 6042
      name: 'oracleNotUpdated'
      msg: 'Oracle not updated'
    },
    {
      code: 6043
      name: 'maxDepositAmountExceeded'
      msg: 'Max deposit amount exceeded'
    },
    {
      code: 6044
      name: 'totalAssetExceedNewMaxDepositAmount'
      msg: 'Total asset exceed new max deposit amount'
    },
    {
      code: 6045
      name: 'allocationBpsIsZero'
      msg: 'Allocation bps is zero'
    },
    {
      code: 6046
      name: 'depositAmountZero'
      msg: 'Deposit amount is zero'
    },
    {
      code: 6047
      name: 'invalidWithdrawalDelay'
      msg: 'Invalid withdrawal delay'
    },
    {
      code: 6048
      name: 'invalidWithdrawalCooldownPeriod'
      msg: 'Invalid withdrawal cooldown period'
    },
    {
      code: 6049
      name: 'invalidOracleBuffer'
      msg: 'Invalid oracle buffer'
    },
    {
      code: 6050
      name: 'excessivePerformanceFee'
      msg: 'Excessive performance fee'
    },
    {
      code: 6051
      name: 'excessiveManagementFee'
      msg: 'Excessive management fee'
    },
    {
      code: 6052
      name: 'excessiveDepositFee'
      msg: 'Excessive deposit fee'
    },
    {
      code: 6053
      name: 'excessiveWithdrawFee'
      msg: 'Excessive withdraw fee'
    },
    {
      code: 6054
      name: 'withdrawalDelayNotMet'
      msg: 'Withdrawal delay not met'
    },
    {
      code: 6055
      name: 'invalidAssetPrecision'
      msg: 'Invalid asset precision'
    },
    {
      code: 6056
      name: 'invalidAssetAddress'
      msg: 'Invalid asset address'
    },
    {
      code: 6057
      name: 'invalidPermissionnedDepositor'
      msg: 'Invalid permissionned depositor'
    },
    {
      code: 6058
      name: 'payerNotAuthority'
      msg: 'Payer is not the authority'
    },
    {
      code: 6059
      name: 'strategyAlreadyEnabled'
      msg: 'Strategy is already enabled'
    },
    {
      code: 6060
      name: 'strategyDisabled'
      msg: 'Strategy is disabled'
    },
    {
      code: 6061
      name: 'invalidWithdrawalAmount'
      msg: 'Invalid withdrawal amount'
    },
    {
      code: 6062
      name: 'bundleNotPermissionned'
      msg: 'Not permissionned'
    },
    {
      code: 6063
      name: 'bundleIsPermissionned'
      msg: 'Bundle is permissionned, use initialize_permissioned_bundle_depositor'
    },
    {
      code: 6064
      name: 'tooManyAllocatedReceivers'
      msg: 'Too many allocated receivers'
    },
    {
      code: 6065
      name: 'oracleUpdateTooFrequent'
      msg: 'Oracle update too frequent'
    },
    {
      code: 6066
      name: 'userBundleAccountNotEmpty'
      msg: 'User bundle account not empty'
    },
    {
      code: 6067
      name: 'minDepositAmountNotMet'
      msg: 'Min deposit amount not met'
    },
    {
      code: 6068
      name: 'invalidOracleMaxAge'
      msg: 'Invalid oracle max age'
    },
    {
      code: 6069
      name: 'invalidOracleUpdateTimeLimit'
      msg: 'Invalid oracle update time limit'
    },
  ]
  types: [
    {
      name: 'allocated'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'to'
            type: 'pubkey'
          },
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'allocationsUpdated'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'receiverAddress'
            type: 'pubkey'
          },
          {
            name: 'allocationBps'
            type: 'u32'
          },
        ]
      }
    },
    {
      name: 'assignedProfitShare'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u128'
          },
        ]
      }
    },
    {
      name: 'authorizedReceiverAdded'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'allowed'
            type: 'bool'
          },
        ]
      }
    },
    {
      name: 'authorizedReceiverRemoved'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'allowed'
            type: 'bool'
          },
        ]
      }
    },
    {
      name: 'bundle'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'name'
            type: {
              array: [
                'u8',
                32,
              ]
            }
          },
          {
            name: 'manager'
            type: 'pubkey'
          },
          {
            name: 'keeper'
            type: 'pubkey'
          },
          {
            name: 'treasuryAccount'
            type: 'pubkey'
          },
          {
            name: 'allocatedReceivers'
            type: {
              vec: 'pubkey'
            }
          },
          {
            name: 'bundleUnderlyingBalance'
            type: 'u64'
          },
          {
            name: 'maxDepositAmount'
            type: 'u64'
          },
          {
            name: 'minDepositAmount'
            type: 'u64'
          },
          {
            name: 'withdrawalDelay'
            type: 'u64'
          },
          {
            name: 'performanceFee'
            type: 'u32'
          },
          {
            name: 'managementFeeBps'
            type: 'u32'
          },
          {
            name: 'depositFee'
            type: 'u32'
          },
          {
            name: 'withdrawalFee'
            type: 'u32'
          },
          {
            name: 'managerPfeeShares'
            type: 'u128'
          },
          {
            name: 'currentAllocationBps'
            type: 'u32'
          },
          {
            name: 'oracleBuffer'
            type: 'u64'
          },
          {
            name: 'oracleUpdateTimeLimit'
            type: 'i64'
          },
          {
            name: 'oracleMaxAge'
            type: 'i64'
          },
          {
            name: 'totalShares'
            type: 'u128'
          },
          {
            name: 'assetPrecision'
            type: 'u64'
          },
          {
            name: 'assetAddress'
            type: 'pubkey'
          },
          {
            name: 'assetDecimals'
            type: 'u8'
          },
          {
            name: 'withdrawalTMin'
            type: 'i64'
          },
          {
            name: 'withdrawalTMax'
            type: 'i64'
          },
          {
            name: 'withdrawalCurve'
            type: 'f32'
          },
          {
            name: 'permissionned'
            type: 'bool'
          },
          {
            name: 'managerMfeeShares'
            type: 'u128'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                239,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'bundleCreatorAccount'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'allowed'
            type: 'bool'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                64,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'bundleCreatorAccountChanged'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'creator'
            type: 'pubkey'
          },
          {
            name: 'allowed'
            type: 'bool'
          },
        ]
      }
    },
    {
      name: 'bundleDepositorInitialized'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'bundleDepositor'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'bundleMasterAccount'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'admin'
            type: 'pubkey'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                96,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'bundleMasterAccountInitialized'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'admin'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'bundleMasterAdminChanged'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'newAdmin'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'bundleTempData'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'cumulativePendingDeposits'
            type: 'u64'
          },
          {
            name: 'pendingDepositsCounter'
            type: 'u64'
          },
          {
            name: 'pendingWithdrawalsCounter'
            type: 'u64'
          },
          {
            name: 'pendingLockedWithdrawalsCounter'
            type: 'u64'
          },
          {
            name: 'lastTotalSharesMinted'
            type: 'u128'
          },
          {
            name: 'lastNettingTimestamp'
            type: 'i64'
          },
          {
            name: 'isNettingDone'
            type: 'bool'
          },
          {
            name: 'distributionBaseAmount'
            type: 'u64'
          },
          {
            name: 'isDistributionStarted'
            type: 'bool'
          },
          {
            name: 'pausedDepositsWithdrawals'
            type: 'bool'
          },
          {
            name: 'leftToDistribute'
            type: 'u64'
          },
          {
            name: 'allocatedShares'
            type: 'u128'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                168,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'changedCoreParams'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'treasury'
            type: 'pubkey'
          },
          {
            name: 'depositFee'
            type: 'u32'
          },
          {
            name: 'withdrawalFee'
            type: 'u32'
          },
          {
            name: 'performanceFee'
            type: 'u32'
          },
          {
            name: 'managementFeeBps'
            type: 'u32'
          },
        ]
      }
    },
    {
      name: 'chargedFeesToUser'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'totalFeeShares'
            type: 'u128'
          },
          {
            name: 'totalFeeValue'
            type: 'u64'
          },
          {
            name: 'managementFeeShares'
            type: 'u128'
          },
          {
            name: 'performanceFeeShares'
            type: 'u128'
          },
          {
            name: 'sharePrice'
            type: 'u128'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'delaysSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'withdrawalDelay'
            type: 'u64'
          },
          {
            name: 'withdrawalTMin'
            type: 'i64'
          },
          {
            name: 'withdrawalTMax'
            type: 'i64'
          },
          {
            name: 'withdrawalCurve'
            type: 'f32'
          },
        ]
      }
    },
    {
      name: 'depositRequested'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'user'
            type: 'pubkey'
          },
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
          {
            name: 'toppingUp'
            type: 'bool'
          },
        ]
      }
    },
    {
      name: 'depositedToDriftVault'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'to'
            type: 'pubkey'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'distributedToReceivers'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'receiver'
            type: 'pubkey'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'distributionEnded'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'distributionStarted'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'dustSharesBurned'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u128'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'initializedNewVaultDepositor'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'vault'
            type: 'pubkey'
          },
          {
            name: 'vaultDepositor'
            type: 'pubkey'
          },
          {
            name: 'keeper'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'initializedReceivers'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'manager'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'initializedVault'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'manager'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'managerWithdrawal'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'managerShares'
            type: 'u128'
          },
          {
            name: 'redemptionAmount'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'maxDepositAmountSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'maxDepositAmount'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'minDepositAmountSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'minDepositAmount'
            type: 'u64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'nettingCompleted'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'newKeeperSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'keeper'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'newManagerSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'manager'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'oracleBufferSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'oracleBuffer'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'oracleData'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'averageExternalEquity'
            type: 'u64'
          },
          {
            name: 'lastUpdateTime'
            type: 'i64'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                64,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'oracleMaxAgeSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'oracleMaxAge'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'oracleUpdateTimeLimitSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'oracleUpdateTimeLimit'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'oracleUpdated'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'averageExternalEquity'
            type: 'u64'
          },
        ]
      }
    },
    {
      name: 'pausedDepositsWithdrawals'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'paused'
            type: 'bool'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'redeemed'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'to'
            type: 'pubkey'
          },
          {
            name: 'netAmount'
            type: 'u64'
          },
          {
            name: 'feeAmount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'refilled'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'refillValue'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'refundedDeposit'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'user'
            type: 'pubkey'
          },
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'requestedWithdrawalToDriftVault'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'to'
            type: 'pubkey'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
    {
      name: 'strategy'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'receiverAddress'
            type: 'pubkey'
          },
          {
            name: 'allocationBps'
            type: 'u32'
          },
          {
            name: 'allowed'
            type: 'bool'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                96,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'strategyAdded'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'receiverAddress'
            type: 'pubkey'
          },
          {
            name: 'allocationBps'
            type: 'u32'
          },
        ]
      }
    },
    {
      name: 'strategyEnabled'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'receiverAddress'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'strategyRemoved'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'receiverAddress'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'userBundleAccount'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'owner'
            type: 'pubkey'
          },
          {
            name: 'lastDepositTimestamp'
            type: 'i64'
          },
          {
            name: 'shares'
            type: 'u128'
          },
          {
            name: 'pendingDeposit'
            type: 'u64'
          },
          {
            name: 'pendingShares'
            type: 'u128'
          },
          {
            name: 'estimatedPendingWithdrawalValue'
            type: 'u64'
          },
          {
            name: 'withdrawalAvailableTimestamp'
            type: 'i64'
          },
          {
            name: 'lastWithdrawalProcessTimestamp'
            type: 'i64'
          },
          {
            name: 'lastHighWaterMark'
            type: 'u128'
          },
          {
            name: 'hwmPerShare'
            type: 'u128'
          },
          {
            name: 'lastManagementFeeTimestamp'
            type: 'i64'
          },
          {
            name: 'netDeposits'
            type: 'i128'
          },
          {
            name: 'totalFeeCharged'
            type: 'u64'
          },
          {
            name: 'padding'
            type: {
              array: [
                'u8',
                264,
              ]
            }
          },
        ]
      }
    },
    {
      name: 'userBundleAccountClosed'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'user'
            type: 'pubkey'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
          {
            name: 'userBundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'vaultNeutralFeeIncrementerSet'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'neutralFeeIncrementer'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'withdrawalRequested'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'user'
            type: 'pubkey'
          },
          {
            name: 'amount'
            type: 'u128'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
          {
            name: 'cooldownPeriod'
            type: 'i64'
          },
          {
            name: 'estimatedPendingWithdrawalValue'
            type: 'u64'
          },
          {
            name: 'bundleAccountKey'
            type: 'pubkey'
          },
        ]
      }
    },
    {
      name: 'withdrawnFromDriftVault'
      type: {
        kind: 'struct'
        fields: [
          {
            name: 'amount'
            type: 'u64'
          },
          {
            name: 'from'
            type: 'pubkey'
          },
          {
            name: 'to'
            type: 'pubkey'
          },
          {
            name: 'timestamp'
            type: 'i64'
          },
        ]
      }
    },
  ]
}
