import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
  TalentLayerID,
  ServiceRegistry,
  TalentLayerEscrow,
  TalentLayerPlatformID,
  TalentLayerReview,
} from '../../typechain-types'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const mintFee = 100
const aliceTlId = 1
const bobTlId = 2
const serviceId = 1
const trasactionId = 0
const transactionAmount = 100
const ethAddress = '0x0000000000000000000000000000000000000000'

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerID, TalentLayerPlatformID, ServiceRegistry, TalentLayerEscrow, TalentLayerReview]
> {
  const [deployer, , , carol] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID, takentLayerEscrow, , serviceRegistry, talentLayerReview] = await deploy(
    false,
  )

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Update mint fee
  await talentLayerID.connect(deployer).updateMintFee(100)

  return [talentLayerID, talentLayerPlatformID, serviceRegistry, takentLayerEscrow, talentLayerReview]
}

describe('Delegation System', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    serviceRegistry: ServiceRegistry,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerReview: TalentLayerReview

  before(async function () {
    ;[, alice, bob, , dave, eve] = await ethers.getSigners()
    ;[talentLayerID, talentLayerPlatformID, serviceRegistry, talentLayerEscrow, talentLayerReview] =
      await deployAndSetup()
  })

  describe('Adding a delegator', async function () {
    it('Alice can add Dave to her delegators', async function () {
      await talentLayerID.connect(alice).addDelegator(dave.address)
      const isDelegator = await talentLayerID.isDelegator(alice.address, dave.address)
      expect(isDelegator).to.be.true
    })
  })

  describe('Mint TalentLayer ID with delegator', async function () {
    it('Dave can mint a TalentLayerID for Alice paying the mint fee', async function () {
      const tx = await talentLayerID.connect(dave).mintByDelegator(carolPlatformId, alice.address, 'alice', {
        value: mintFee,
      })
      const tlId = await talentLayerID.walletOfOwner(alice.address)
      expect(tlId).to.be.equal(aliceTlId)

      await expect(tx).to.changeEtherBalances([alice, dave], [0, -mintFee])
    })

    it("Dave cannot mint a TalentLayerID for Bob, since he's not his delegator", async function () {
      const tx = talentLayerID.connect(dave).mintByDelegator(carolPlatformId, bob.address, 'bob', {
        value: mintFee,
      })
      expect(tx).to.be.revertedWith('You are not a delegator for this user')
    })
  })

  describe('Service flow with delegator', async function () {
    before(async function () {
      // Set Eve as Bob's delegator
      await talentLayerID.connect(bob).addDelegator(eve.address)
      // Mint TalentLayerID for Bob
      await talentLayerID.connect(eve).mintByDelegator(carolPlatformId, bob.address, 'bob', {
        value: mintFee,
      })
    })

    it('Dave can open a service on behalf of Alice', async function () {
      await serviceRegistry.connect(dave).createOpenServiceFromBuyer(aliceTlId, carolPlatformId, 'cid')
      const serviceData = await serviceRegistry.services(1)

      expect(serviceData.buyerId.toNumber()).to.be.equal(aliceTlId)
      expect(serviceData.initiatorId.toNumber()).to.be.equal(aliceTlId)
    })

    it('Dave can update service data on behalf of Alice', async function () {
      const tx = await serviceRegistry.connect(dave).updateServiceData(aliceTlId, serviceId, 'newCid')
      await expect(tx).to.not.be.reverted
    })

    it('Eve can create a proposal on behalf of Bob', async function () {
      await serviceRegistry.connect(eve).createProposal(bobTlId, serviceId, ethAddress, transactionAmount, 'uri')
      const proposal = await serviceRegistry.proposals(serviceId, bobTlId)
      expect(proposal.sellerId).to.eq(bobTlId)
    })

    it('Eve can update a proposal on behalf of Bob', async function () {
      const tx = await serviceRegistry
        .connect(eve)
        .updateProposal(bobTlId, serviceId, ethAddress, transactionAmount, 'newUri')
      await expect(tx).to.not.be.reverted
    })

    it('Dave can release a payment on behalf of Alice', async function () {
      const platformData = await talentLayerPlatformID.platforms(carolPlatformId)
      const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
      const originPlatformEscrowFeeRate = await talentLayerEscrow.originPlatformEscrowFeeRate()
      const platformEscrowFeeRate = platformData.fee

      const totalAmount =
        transactionAmount +
        (transactionAmount * (protocolEscrowFeeRate + originPlatformEscrowFeeRate + platformEscrowFeeRate)) / 10000

      // Accept proposal through deposit
      await talentLayerEscrow.connect(alice).createETHTransaction('', serviceId, bobTlId, {
        value: totalAmount,
      })

      // Release payment
      const tx = await talentLayerEscrow.connect(dave).release(trasactionId, 100)
      await expect(tx).to.not.be.reverted
    })

    it('Dave can create a review on behalf of Alice', async function () {
      const tx = await talentLayerReview.connect(dave).addReview(aliceTlId, serviceId, 'uri', 5, carolPlatformId)
      await expect(tx).to.not.be.reverted
    })
  })

  describe('Removing a delegator', async function () {
    it('Alice can remove Dave from her delegators', async function () {
      await talentLayerID.connect(alice).removeDelegator(dave.address)
      const isDelegator = await talentLayerID.isDelegator(alice.address, dave.address)
      expect(isDelegator).to.be.false
    })

    it("Dave can't do actions on behalf of Alice anymore", async function () {
      const tx = serviceRegistry.connect(dave).createOpenServiceFromBuyer(aliceTlId, carolPlatformId, 'cid')
      await expect(tx).to.be.revertedWith('Not owner or delegator')
    })
  })
})
3
