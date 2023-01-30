const { upgrades } = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID, TalentLayerPlatformID } from '../../typechain-types'
import { TalentLayerIDV2 } from '../../typechain-types/contracts/TalentLayerIDV2.sol'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerPlatformID, TalentLayerID]> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

  return [talentLayerPlatformID, talentLayerID]
}

describe('TalentLayerId V2 migration testing', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerID: TalentLayerID,
    talentLayerIDV2: TalentLayerIDV2

  before(async function () {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerID] = await deployAndSetup()
  })

  describe('Migrate to V2', async function () {
    it('Should deploy the V2 keeping the same address', async function () {
      const TalentLayerIDV2 = await ethers.getContractFactory('TalentLayerIDV2')
      talentLayerIDV2 = await upgrades.upgradeProxy(talentLayerID.address, TalentLayerIDV2)

      expect(talentLayerIDV2.address).to.equal(talentLayerID.address)
    })
  })
})
