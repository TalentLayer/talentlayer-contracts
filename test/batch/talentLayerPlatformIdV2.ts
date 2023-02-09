// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat')

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerPlatformID, TalentLayerPlatformIDV2 } from '../../typechain-types'
import { deploy } from '../utils/deploy'

/**
 * Deploys contract and sets up the context for dispute resolution.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerPlatformID]> {
  const [deployer, alice] = await ethers.getSigners()
  const [, talentLayerPlatformID] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, alice.address)

  return [talentLayerPlatformID]
}

describe('Platform ID V2 migration testing', function () {
  let alice: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerPlatformIDV2: TalentLayerPlatformIDV2

  before(async function () {
    ;[, alice] = await ethers.getSigners()
    ;[talentLayerPlatformID] = await deployAndSetup()
  })

  describe('Migrate to V2', async function () {
    it('Should deploy the V2 keeping the same address', async function () {
      const TalentLayerPlatformIDV2 = await ethers.getContractFactory('TalentLayerPlatformIDV2')
      talentLayerPlatformIDV2 = await upgrades.upgradeProxy(
        talentLayerPlatformID.address,
        TalentLayerPlatformIDV2,
      )

      expect(talentLayerPlatformIDV2.address).to.equal(talentLayerPlatformID.address)
    })
  })
})
