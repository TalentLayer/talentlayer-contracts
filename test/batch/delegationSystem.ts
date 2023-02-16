import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
  TalentLayerID,
  TalentLayerService,
  TalentLayerEscrow,
  TalentLayerPlatformID,
  TalentLayerReview,
} from '../../typechain-types'
import { deploy } from '../utils/deploy'

const carolPlatformId = 1
const aliceTlId = 1
const bobTlId = 2
const serviceId = 1
const trasactionId = 0
const transactionAmount = 100
const ethAddress = '0x0000000000000000000000000000000000000000'

const now = Math.floor(Date.now() / 1000)
const proposalExpirationDate = now + 60 * 60 * 24 * 15

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(
  tokenAddress: string,
): Promise<
  [TalentLayerID, TalentLayerPlatformID, TalentLayerService, TalentLayerEscrow, TalentLayerReview]
> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    takentLayerEscrow,
    ,
    talentLayerService,
    talentLayerReview,
  ] = await deploy(false)

  // Deployer whitelists a list of authorized tokens
  await talentLayerService.connect(deployer).updateAllowedTokenList(tokenAddress, true)

  // Deployer mints Platform Id for Carol
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

  return [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerService,
    takentLayerEscrow,
    talentLayerReview,
  ]
}

describe('Delegation System', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerService: TalentLayerService,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerReview: TalentLayerReview

  before(async function () {
    ;[, alice, bob, , dave, eve] = await ethers.getSigners()
    ;[
      talentLayerID,
      talentLayerPlatformID,
      talentLayerService,
      talentLayerEscrow,
      talentLayerReview,
    ] = await deployAndSetup(ethAddress)
  })

  describe('Adding a delegate', async function () {
    it('Alice can add Dave to her delegates', async function () {
      // Fails if the caller is not the owner of the TL Id
      const tx = talentLayerID.connect(bob).addDelegate(aliceTlId, dave.address)
      await expect(tx).to.be.revertedWith('Only owner can add delegates')

      await talentLayerID.connect(alice).addDelegate(aliceTlId, dave.address)
      const isDelegate = await talentLayerID.isDelegate(aliceTlId, dave.address)
      expect(isDelegate).to.be.true
    })

    it('Dave can update Alice profile data', async function () {
      // Fails if caller is not the owner or delegate
      const failTx = talentLayerID.connect(eve).updateProfileData(aliceTlId, 'newUri')
      await expect(failTx).to.be.revertedWith('Not owner or delegate')

      const tx = await talentLayerID.connect(dave).updateProfileData(aliceTlId, 'newUri')
      await expect(tx).to.not.be.reverted
    })
  })

  describe('Service flow with delegate', async function () {
    before(async function () {
      // Set Eve as Bob's delegate
      await talentLayerID.connect(bob).addDelegate(bobTlId, eve.address)
    })

    it('Dave can open a service on behalf of Alice', async function () {
      // Fails if caller is not the owner or delegate
      const tx = talentLayerService.connect(eve).createService(aliceTlId, carolPlatformId, 'cid')
      await expect(tx).to.be.revertedWith('Not owner or delegate')

      await talentLayerService.connect(dave).createService(aliceTlId, carolPlatformId, 'cid')
      const serviceData = await talentLayerService.services(1)

      expect(serviceData.ownerId.toNumber()).to.be.equal(aliceTlId)
    })

    it('Dave can update service data on behalf of Alice', async function () {
      const tx = await talentLayerService
        .connect(dave)
        .updateServiceData(aliceTlId, serviceId, 'newCid')
      await expect(tx).to.not.be.reverted
    })

    it('Eve can create a proposal on behalf of Bob', async function () {
      await talentLayerService
        .connect(eve)
        .createProposal(
          bobTlId,
          serviceId,
          ethAddress,
          transactionAmount,
          carolPlatformId,
          'uri',
          proposalExpirationDate,
        )
      const proposal = await talentLayerService.proposals(serviceId, bobTlId)
      expect(proposal.ownerId).to.eq(bobTlId)
    })

    it('Eve can update a proposal on behalf of Bob', async function () {
      const tx = await talentLayerService
        .connect(eve)
        .updateProposal(bobTlId, serviceId, ethAddress, transactionAmount, 'newUri')
      await expect(tx).to.not.be.reverted
    })

    it('Dave can release a payment on behalf of Alice', async function () {
      const platformData = await talentLayerPlatformID.platforms(carolPlatformId)
      const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
      const originServiceFeeRate = platformData.originServiceFeeRate
      const originValidatedProposalFeeRate = platformData.originValidatedProposalFeeRate

      const totalAmount =
        transactionAmount +
        (transactionAmount *
          (protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)) /
          10000

      // we need to retreive the Bob proposal dataUri
      const proposal = await talentLayerService.proposals(serviceId, bobTlId)

      // Accept proposal through deposit
      await talentLayerEscrow
        .connect(alice)
        .createETHTransaction('', serviceId, bobTlId, proposal.dataUri, {
          value: totalAmount,
        })

      // Fails is caller is not the owner or delegate
      const failTx = talentLayerEscrow.connect(eve).release(aliceTlId, trasactionId, 100)
      await expect(failTx).to.be.revertedWith('Not owner or delegate')

      // Release payment
      const tx = await talentLayerEscrow.connect(dave).release(aliceTlId, trasactionId, 100)
      await expect(tx).to.not.be.reverted
    })

    it('Dave can create a review on behalf of Alice', async function () {
      // Fails is caller is not the owner or delegate
      const failTx = talentLayerReview
        .connect(eve)
        .addReview(aliceTlId, serviceId, 'uri', 5, carolPlatformId)
      await expect(failTx).to.be.revertedWith('Not owner or delegate')

      const tx = await talentLayerReview
        .connect(dave)
        .addReview(aliceTlId, serviceId, 'uri', 5, carolPlatformId)
      await expect(tx).to.not.be.reverted
    })
  })

  describe('Removing a delegate', async function () {
    it('Alice can remove Dave from her delegates', async function () {
      await talentLayerID.connect(alice).removeDelegate(aliceTlId, dave.address)
      const isDelegate = await talentLayerID.isDelegate(alice.address, dave.address)
      expect(isDelegate).to.be.false
    })

    it("Dave can't do actions on behalf of Alice anymore", async function () {
      const tx = talentLayerService.connect(dave).createService(aliceTlId, carolPlatformId, 'cid')
      await expect(tx).to.be.revertedWith('Not owner or delegate')
    })
  })
})
