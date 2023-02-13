import { ethers } from 'ethers'

export enum Network {
  LOCAL = 1337,
  AVALANCHE = 43114,
  FUJI = 43113,
  POLYGON = 137,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  multisigAddressList: { deployer?: `0x${string}`; fee: `0x${string}` }
  allowedTokenList: { [key: string]: `0x${string}` }
  platformList: { [name: string]: `0x${string}` }
}

const local: NetworkConfig = {
  multisigAddressList: {
    fee: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
  },
  allowedTokenList: {
    ETH: ethers.constants.AddressZero,
  },
  platformList: {
    HireVibes: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    WorkPod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
  },
}

const fuji = {
  multisigAddressList: {
    fee: '0x_TODO_CREATE_MULTISIG',
  },
  allowedTokenList: {
    AVAX: ethers.constants.AddressZero,
    USDC: '0xAF82969ECF299c1f1Bb5e1D12dDAcc9027431160',
  },
  platformList: {
    HireVibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
  },
} as NetworkConfig

const mumbai = {
  multisigAddressList: {
    fee: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
    deployer: '0x99f117069F9ED15476003502AD8D96107A180648',
  },
  allowedTokenList: {
    MATIC: ethers.constants.AddressZero,
    USDC: '0xe6b8a5CF854791412c1f6EFC7CAf629f5Df1c747',
  },
  platformList: {
    HireVibes: '0x96573C632c88996711de69389b501F4D9005Ff4e',
    WorkPod: '0x4444F618BA8E99435E721abF3c611D5105A407e9',
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
