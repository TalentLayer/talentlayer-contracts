import { ethers, network, upgrades } from 'hardhat'
import { getConfig, Network, NetworkConfig } from '../../scripts/utils/config'
import {
  MockProofOfHumanity,
  ServiceRegistry,
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
    ServiceRegistry,
    TalentLayerReview,
    MockProofOfHumanity,
    SimpleERC20,
  ]
> {
  const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
  const networkConfig: NetworkConfig = getConfig(chainId)

  // Deploy MockProofOfHumanity
  const MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
  const mockProofOfHumanity = await MockProofOfHumanity.deploy()

  // Deploy PlatformId
  const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
  let talentLayerPlatformID = await upgrades.deployProxy(TalentLayerPlatformID)

  if (applyUpgrade) {
    const TalentLayerPlatformIDV2 = await ethers.getContractFactory('TalentLayerPlatformIDV2')
    talentLayerPlatformID = await upgrades.upgradeProxy(talentLayerPlatformID.address, TalentLayerPlatformIDV2)
  }

  // Deploy TalenLayerID
  const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
  const talentLayerIDArgs: [string, string] = [mockProofOfHumanity.address, talentLayerPlatformID.address]
  let talentLayerID = await upgrades.deployProxy(TalentLayerID, talentLayerIDArgs)

  if (applyUpgrade) {
    const TalentLayerIDV2 = await ethers.getContractFactory('TalentLayerIDV2')
    talentLayerID = await upgrades.upgradeProxy(talentLayerID.address, TalentLayerIDV2)
  }

  // Deploy ServiceRegistry
  const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
  const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
  let serviceRegistry = await upgrades.deployProxy(ServiceRegistry, serviceRegistryArgs)

  if (applyUpgrade) {
    const ServiceRegistryV2 = await ethers.getContractFactory('ServiceRegistryV2')
    serviceRegistry = await upgrades.upgradeProxy(serviceRegistry.address, ServiceRegistryV2)
  }

  // Deploy TalentLayerArbitrator
  const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
  const talentLayerArbitrator = await TalentLayerArbitrator.deploy(talentLayerPlatformID.address)

  // Deploy TalentLayerEscrow and escrow role on ServiceRegistry
  const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
  const TalentLayerEscrowArgs: [string, string, string, string | undefined] = [
    serviceRegistry.address,
    talentLayerID.address,
    talentLayerPlatformID.address,
    networkConfig.multisigAddress,
  ]
  let talentLayerEscrow = await upgrades.deployProxy(TalentLayerEscrow, TalentLayerEscrowArgs)
  const escrowRole = await serviceRegistry.ESCROW_ROLE()
  await serviceRegistry.grantRole(escrowRole, talentLayerEscrow.address)

  if (applyUpgrade) {
    const TalentLayerEscrowV2 = await ethers.getContractFactory('TalentLayerEscrowV2')
    talentLayerEscrow = await upgrades.upgradeProxy(talentLayerEscrow.address, TalentLayerEscrowV2)
  }

  // Deploy TalentLayerReview
  const TalentLayerReview = await ethers.getContractFactory('TalentLayerReview')
  const talentLayerReviewArgs: [string, string, string, string, string] = [
    'TalentLayer Review',
    'TLR',
    talentLayerID.address,
    serviceRegistry.address,
    talentLayerPlatformID.address,
  ]
  let talentLayerReview = await upgrades.deployProxy(TalentLayerReview, talentLayerReviewArgs)

  if (applyUpgrade) {
    const TalentLayerReviewV2 = await ethers.getContractFactory('TalentLayerReviewV2')
    talentLayerReview = await upgrades.upgradeProxy(talentLayerReview.address, TalentLayerReviewV2)
  }

  // Deploy SimpleERC20 Token
  const SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
  const simpleERC20 = await SimpleERC20.deploy()

  return [
    talentLayerID as TalentLayerID,
    talentLayerPlatformID as TalentLayerPlatformID,
    talentLayerEscrow as TalentLayerEscrow,
    talentLayerArbitrator,
    serviceRegistry as ServiceRegistry,
    talentLayerReview as TalentLayerReview,
    mockProofOfHumanity,
    simpleERC20,
  ]
}
