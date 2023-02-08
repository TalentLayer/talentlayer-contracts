import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerID, ServiceRegistry } from '../../typechain-types'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const mintFee = 100
const aliceTlId = 1

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerID, ServiceRegistry]> {
  const [deployer, , , carol] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID, , , serviceRegistry] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Update mint fee
  await talentLayerID.connect(deployer).updateMintFee(100)

  return [talentLayerID, serviceRegistry]
}

describe.only('Delegation System', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerID: TalentLayerID,
    serviceRegistry: ServiceRegistry

  before(async function () {
    ;[, alice, bob, , dave] = await ethers.getSigners()
    ;[talentLayerID, serviceRegistry] = await deployAndSetup()
  })

  describe('Adding a delegator', async function () {
    it('Alice can add Bob to her delegators', async function () {
      await talentLayerID.connect(alice).addDelegator(bob.address)
      const isDelegator = await talentLayerID.isDelegator(alice.address, bob.address)
      expect(isDelegator).to.be.true
    })
  })

  describe('Mint TalentLayer ID with delegator', async function () {
    it('Bob can mint a TalentLayerID for Alice paying the mint fee', async function () {
      const tx = await talentLayerID.connect(bob).mintByDelegator(carolPlatformId, alice.address, 'bob', {
        value: mintFee,
      })
      const tlId = await talentLayerID.walletOfOwner(alice.address)
      expect(tlId).to.be.equal(aliceTlId)

      await expect(tx).to.changeEtherBalances([alice, bob], [0, -mintFee])
    })

    it("Bob cannot mint a TalentLayerID for Dave, since he's not his delegator", async function () {
      const tx = talentLayerID.connect(bob).mintByDelegator(carolPlatformId, dave.address, 'dave', {
        value: mintFee,
      })
      expect(tx).to.be.revertedWith('You are not a delegator for this user')
    })
  })

  describe('Service flow with delegator', async function () {
    it('Bob can open a service for Alice', async function () {
      await serviceRegistry.connect(bob).createOpenServiceFromBuyer(aliceTlId, carolPlatformId, 'cid')
      const serviceData = await serviceRegistry.services(1)

      expect(serviceData.buyerId.toNumber()).to.be.equal(aliceTlId)
      expect(serviceData.initiatorId.toNumber()).to.be.equal(aliceTlId)
    })
  })

  describe('Removing a delegator', async function () {
    it('Alice can remove Bob from her delegators', async function () {
      await talentLayerID.connect(alice).removeDelegator(bob.address)
      const isDelegator = await talentLayerID.isDelegator(alice.address, bob.address)
      expect(isDelegator).to.be.false
    })
  })
})
