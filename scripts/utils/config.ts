export enum Network {
  LOCAL = 1337,
  AVALANCHE = 43114,
  FUJI = 43113,
  POLYGON = 137,
  MUMBAI = 80001,
}

export type NetworkConfig = {
  multisigDeployerAddress: string
  multisigFeeAddress?: string
}

const local = { multisigFeeAddress: '0x3Fba71369E5E2E947AE2320274b1677de7D28120' } as NetworkConfig
const avalanche = {} as NetworkConfig
const fuji = {} as NetworkConfig
const polygon = {} as NetworkConfig
const mumbai = {
  multisigDeployerAddress: '0x99f117069F9ED15476003502AD8D96107A180648',
  multisigFeeAddress: '0x3Fba71369E5E2E947AE2320274b1677de7D28120',
} as NetworkConfig

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
