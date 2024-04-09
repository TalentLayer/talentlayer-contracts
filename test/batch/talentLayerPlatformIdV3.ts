// eslint-disable-next-line @typescript-eslint/no-var-requires
const { upgrades } = require('hardhat')
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers'
import {expect} from 'chai'
import {ethers} from 'hardhat'
import {TalentLayerPlatformID, TalentLayerPlatformIDV2} from '../../typechain-types'
import {deploy} from '../utils/deploy'

/**
 * Deploys contracts and sets up the context for TalentLayerPlatformId contract.
 * @returns the deployed contract
 */
async function deployAndSetup(): Promise<[TalentLayerPlatformIDV2]> {
  const [deployer, alice, bob] = await ethers.getSigners()
  const [, talentLayerPlatformID] = await deploy(false)

  // Deployer mints Platform Id for Carol
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress('pigeon-club', alice.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress('racoon-corp', bob.address)

  // Upgrade to TalentLayerPlatformIDV2
  const TalentLayerPlatformIDV2 = await ethers.getContractFactory('TalentLayerPlatformIDV2')
  const talentLayerPlatformIDV2 = await upgrades.upgradeProxy(talentLayerPlatformID.address, TalentLayerPlatformIDV2)


  return [talentLayerPlatformIDV2]
}

describe('TalentLayerPlatformID V2 migration testing', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformIDV2: TalentLayerPlatformIDV2,
    talentLayerPlatformIDV3: TalentLayerPlatformID

  before(async function () {
    [, alice, bob, carol] = await ethers.getSigners();
    [talentLayerPlatformIDV2] = await deployAndSetup();
  })

  describe('TalentLayerPlatformIDV2', async function () {
    it('Should not allow the transfer of PlatformId', async function () {
      expect(talentLayerPlatformIDV2.connect(alice).transferFrom(alice.address, carol.address, 1)).to.be.revertedWith('Token transfer is not allowed');
    })
  })

  describe('Migrate to V3', async function () {
    it('Should deploy the V3 keeping the same address', async function () {
      const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
      talentLayerPlatformIDV3 = await upgrades.upgradeProxy(talentLayerPlatformIDV2.address, TalentLayerPlatformID)
      expect(talentLayerPlatformIDV3.address).to.equal(talentLayerPlatformIDV2.address)
    })

    it('Alice can not transfer her platform ID to Bob who already owns one', async function () {
      const alicePlatformId = await talentLayerPlatformIDV3.ids(alice.address);
      expect(
          talentLayerPlatformIDV3
              .connect(alice)
              .transferFrom(alice.address, bob.address, alicePlatformId),
      ).to.be.revertedWith('Recipient already has a Platform ID')
    })

    it('Alice can transfer her platform ID to Carol who does not own one', async function () {
      const alicePlatformId = await talentLayerPlatformIDV3.ids(alice.address);
      expect(
          talentLayerPlatformIDV3
              .transferFrom(alice.address, carol.address, alicePlatformId),
      ).not.to.be.revertedWith('Recipient already has a Platform ID')
    })
  })
})
