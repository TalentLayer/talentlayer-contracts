import { ethers, network, upgrades } from 'hardhat'
import { getConfig, Network, NetworkConfig } from '../../networkConfig'
import {
  TalentLayerService,
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerEscrowV1,
  TalentLayerID,
  TalentLayerPlatformID,
  TalentLayerReview,
  TalentLayerServiceV1,
} from '../../typechain-types'

/**
 * Deploys protocol contracts
 * For upgradable contracts, we deploy only their first version
 */
export async function deploy(
  applyUpgrade: boolean,
): Promise<
  [
    TalentLayerID,
    TalentLayerPlatformID,
    TalentLayerEscrow,
    TalentLayerArbitrator,
    TalentLayerService,
    TalentLayerReview,
    SimpleERC20,
  ]
> {
  const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
  const networkConfig: NetworkConfig = getConfig(chainId)

  // Deploy PlatformId
  const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
  const talentLayerPlatformID = await upgrades.deployProxy(TalentLayerPlatformID)

  // Deploy TalentLayerID
  const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
  const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
  let talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)

  if (applyUpgrade) {
    const TalentLayerIDV2 = await ethers.getContractFactory('TalentLayerID')
    talentLayerID = await upgrades.upgradeProxy(talentLayerID.address, TalentLayerIDV2)
  }

  // Deploy TalentLayerService
  const TalentLayerService = await ethers.getContractFactory('TalentLayerService')
  const talentLayerServiceArgs: [string, string] = [
    talentLayerID.address,
    talentLayerPlatformID.address,
  ]
  let talentLayerService = await upgrades.deployProxy(TalentLayerService, talentLayerServiceArgs)

  // Deploy TalentLayerArbitrator
  const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
  const talentLayerArbitrator = await TalentLayerArbitrator.deploy(talentLayerPlatformID.address)

  // Deploy TalentLayerEscrow and escrow role on TalentLayerService
  const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
  const TalentLayerEscrowArgs: [string, string, string, string | undefined] = [
    talentLayerService.address,
    talentLayerID.address,
    talentLayerPlatformID.address,
    networkConfig.multisigAddressList.fee,
  ]
  let talentLayerEscrow = await upgrades.deployProxy(TalentLayerEscrow, TalentLayerEscrowArgs)
  const escrowRole = await talentLayerService.ESCROW_ROLE()
  await talentLayerService.grantRole(escrowRole, talentLayerEscrow.address)

  // Deploy TalentLayerReview
  const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
  const talentLayerReviewArgs: [string, string] = [
    talentLayerID.address,
    talentLayerService.address,
  ]
  const talentLayerReview = await upgrades.deployProxy(TalentLayerReview, talentLayerReviewArgs)

  // Deploy SimpleERC20 Token
  const SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
  const simpleERC20 = await SimpleERC20.deploy()

  if (applyUpgrade) {
    const talentLayerEscrowV2 = await ethers.getContractFactory('TalentLayerEscrowV2')
    talentLayerEscrow = await upgrades.upgradeProxy(talentLayerEscrow.address, talentLayerEscrowV2)
    const talentLayerServiceV2 = await ethers.getContractFactory('TalentLayerServiceV2')
    talentLayerService = await upgrades.upgradeProxy(
      talentLayerService.address,
      talentLayerServiceV2,
    )
  }

  return [
    talentLayerID as TalentLayerID,
    talentLayerPlatformID as TalentLayerPlatformID,
    talentLayerEscrow as TalentLayerEscrow,
    talentLayerArbitrator,
    talentLayerService as TalentLayerService,
    talentLayerReview as TalentLayerReview,
    simpleERC20,
  ]
}
export async function deployForV1(): Promise<
  [
    TalentLayerID,
    TalentLayerPlatformID,
    TalentLayerEscrowV1,
    TalentLayerArbitrator,
    TalentLayerServiceV1,
    TalentLayerReview,
    SimpleERC20,
  ]
> {
  const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
  const networkConfig: NetworkConfig = getConfig(chainId)

  // Deploy PlatformId
  const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
  const talentLayerPlatformID = await upgrades.deployProxy(TalentLayerPlatformID)

  // Deploy TalentLayerID
  const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
  const talentLayerIDArgs: [string] = [talentLayerPlatformID.address]
  const talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)

  // Deploy TalentLayerService
  const TalentLayerService = await ethers.getContractFactory('TalentLayerServiceV1')
  const talentLayerServiceArgs: [string, string] = [
    talentLayerID.address,
    talentLayerPlatformID.address,
  ]
  const talentLayerService = await upgrades.deployProxy(TalentLayerService, talentLayerServiceArgs)

  // Deploy TalentLayerArbitrator
  const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
  const talentLayerArbitrator = await TalentLayerArbitrator.deploy(talentLayerPlatformID.address)

  // Deploy TalentLayerEscrow and escrow role on TalentLayerService
  const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrowV1')
  const TalentLayerEscrowArgs: [string, string, string, string | undefined] = [
    talentLayerService.address,
    talentLayerID.address,
    talentLayerPlatformID.address,
    networkConfig.multisigAddressList.fee,
  ]
  const talentLayerEscrow = await upgrades.deployProxy(TalentLayerEscrow, TalentLayerEscrowArgs)
  const escrowRole = await talentLayerService.ESCROW_ROLE()
  await talentLayerService.grantRole(escrowRole, talentLayerEscrow.address)

  // Deploy TalentLayerReview
  const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
  const talentLayerReviewArgs: [string, string] = [
    talentLayerID.address,
    talentLayerService.address,
  ]
  const talentLayerReview = await upgrades.deployProxy(TalentLayerReview, talentLayerReviewArgs)

  // Deploy SimpleERC20 Token
  const SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
  const simpleERC20 = await SimpleERC20.deploy()

  return [
    talentLayerID as TalentLayerID,
    talentLayerPlatformID as TalentLayerPlatformID,
    talentLayerEscrow as TalentLayerEscrowV1,
    talentLayerArbitrator,
    talentLayerService as TalentLayerServiceV1,
    talentLayerReview as TalentLayerReview,
    simpleERC20,
  ]
}

export const upgradeServiceV1 = async (talentLayerServiceAddress: string) => {
  const talentLayerServiceUpgrade = await ethers.getContractFactory('TalentLayerService')
  const talentLayerService = await upgrades.upgradeProxy(
    talentLayerServiceAddress,
    talentLayerServiceUpgrade,
  )

  return talentLayerService as TalentLayerService
}

export const upgradeEscrowV1 = async (talentLayerEscrowAddress: string) => {
  const talentLayerEscrowUpgrade = await ethers.getContractFactory('TalentLayerEscrow')
  const talentLayerEscrow = await upgrades.upgradeProxy(
    talentLayerEscrowAddress,
    talentLayerEscrowUpgrade,
  )
  return talentLayerEscrow as TalentLayerEscrow
}
