// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
  ServiceRegistry,
  ServiceRegistryV2,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerPlatformID,
  TalentLayerReview,
} from '../../typechain-types'
import { BigNumber } from 'ethers'
import { TalentLayerReviewV2 } from '../../typechain-types/contracts/tests'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const serviceId = 1
const transactionAmount = BigNumber.from(1000)
const ethAddress = '0x0000000000000000000000000000000000000000'

/**
 * Deploys contracts and sets up the context for TalentLayerReview contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [
    TalentLayerPlatformID,
    TalentLayerEscrow,
    TalentLayerArbitrator,
    ServiceRegistry,
    TalentLayerReview,
  ]
> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    serviceRegistry,
    talentLayerReview,
  ] = await deploy(false)

  // // Deployer mints Platform Id for Carol
  // const platformName = 'HireVibes'
  // await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // // Mint TL Id for Alice and Bob
  // await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  // await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

  return [
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    serviceRegistry,
    talentLayerReview,
  ]
}

describe('TalentLayerReview V2 migration testing', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    serviceRegistry: ServiceRegistry,
    talentLayerReview: TalentLayerReview,
    talentLayerReviewV2: TalentLayerReviewV2

  before(async function () {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerArbitrator,
      serviceRegistry,
      talentLayerReview,
    ] = await deployAndSetup()
  })

  describe('Migrate to V2', async function () {
    it('Should deploy the V2 keeping the same address', async function () {
      const TalentLayerReviewV2 = await ethers.getContractFactory('TalentLayerReviewV2')
      talentLayerReviewV2 = await upgrades.upgradeProxy(
        talentLayerReview.address,
        TalentLayerReviewV2,
      )

      expect(talentLayerReviewV2.address).to.equal(talentLayerReview.address)
    })
  })
})
