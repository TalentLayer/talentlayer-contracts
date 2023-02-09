const { upgrades } = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import {
  ServiceRegistry,
  ServiceRegistryV2,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerPlatformID,
} from '../../typechain-types'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const serviceId = 1
const transactionAmount = BigNumber.from(1000)
const ethAddress = '0x0000000000000000000000000000000000000000'

/**
 * Deploys contract and sets up the context for dispute resolution.
 * @returns the deployed contracts
 */
async function deployAndSetup(
  tokenAddress: string,
): Promise<[TalentLayerPlatformID, TalentLayerEscrow, TalentLayerArbitrator, ServiceRegistry]> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    serviceRegistry,
  ] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

  // Alice, the buyer, initiates a new open service
  await serviceRegistry.connect(alice).createOpenServiceFromBuyer(carolPlatformId, 'cid')

  // Bob, the seller, creates a proposal for the service
  await serviceRegistry.connect(bob).createProposal(serviceId, tokenAddress, transactionAmount, carolPlatformId, 'cid')

  return [talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, serviceRegistry]
}

describe('Service registry V2 migration testing', function() {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    serviceRegistry: ServiceRegistry,
    serviceRegistryV2: ServiceRegistryV2

  before(async function() {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, serviceRegistry] = await deployAndSetup(
      ethAddress,
    )
  })

  describe('Migrate to V2', async function() {
    it('Should deploy the V2 keeping the same address', async function() {
      const ServiceRegistryV2 = await ethers.getContractFactory('ServiceRegistryV2')
      serviceRegistryV2 = await upgrades.upgradeProxy(serviceRegistry.address, ServiceRegistryV2)

      expect(serviceRegistryV2.address).to.equal(serviceRegistry.address)
    })
  })
})
