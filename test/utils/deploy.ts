import { ethers, network, upgrades } from 'hardhat'
import { getConfig, Network, NetworkConfig } from '../../networkConfig'
import {
  TalentLayerService,
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerID,
  TalentLayerPlatformID,
  TalentLayerReview,
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
  const talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)

  // if (applyUpgrade) {
  //   const TalentLayerIDV2 = await ethers.getContractFactory('TalentLayerIDV2')
  //   talentLayerID = await upgrades.upgradeProxy(talentLayerID.address, TalentLayerIDV2)
  // }

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
