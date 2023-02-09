import { ethers } from 'hardhat'

export enum Network {
  LOCAL = 1337,
  AVALANCHE = 43114,
  FUJI = 43113,
  POLYGON = 137,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  multisigDeployerAddress?: string
  multisigFeeAddress?: string
  allowedTokenList: { [key: string]: `0x${string}` }
}

const local = {
  allowedTokenList: {
    ETH: ethers.constants.AddressZero,
  },
  multisigFeeAddress: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
} as NetworkConfig

const fuji = {
  allowedTokenList: {
    AVAX: ethers.constants.AddressZero,
    USDC: '0xAF82969ECF299c1f1Bb5e1D12dDAcc9027431160',
  },
} as NetworkConfig

const mumbai = {
  multisigDeployerAddress: '0x99f117069F9ED15476003502AD8D96107A180648',
  multisigFeeAddress: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
  allowedTokenList: {
    MATIC: ethers.constants.AddressZero,
    USDC: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747',
  },
} as NetworkConfig

const avalanche = {} as NetworkConfig
const polygon = {} as NetworkConfig

export const configs: { [networkId in Network]: NetworkConfig } = {
  [Network.LOCAL]: local,
  [Network.AVALANCHE]: avalanche,
  [Network.FUJI]: fuji,
  [Network.POLYGON]: polygon,
  [Network.MUMBAI]: mumbai,
}

export const getConfig = (networkId: Network): NetworkConfig => {
  return configs[networkId]
}
