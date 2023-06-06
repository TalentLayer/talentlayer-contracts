import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
  TalentLayerService,
  TalentLayerEscrow,
  TalentLayerPlatformID,
  TalentLayerReview,
} from '../../typechain-types'
import {
  MintStatus,
  minTokenWhitelistTransactionAmount,
  cid,
  proposalExpirationDate,
  feeDivider,
  metaEvidenceCid,
  ServiceStatus,
} from '../utils/constant'
import { deploy } from '../utils/deploy'
import { getSignatureForProposal, getSignatureForService } from '../utils/signature'

const aliceTlId = 1
const bobTlId = 2
const carolPlatformId = 1
const proposalId = bobTlId
const transactionAmount = ethers.utils.parseEther('1000')
const tokenAddress = ethers.constants.AddressZero

/**
 * Deploys contract and sets up the context for dispute resolution.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerEscrow, TalentLayerService, TalentLayerPlatformID, TalentLayerReview]
> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    ,
    talentLayerService,
    talentLayerReview,
  ] = await deploy(false)

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Set service contract address on ID contract
  await talentLayerID.connect(deployer).setIsServiceContract(talentLayerService.address, true)

  // Mint TL Id for Alice, Bob and Dave
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob__')

  return [talentLayerEscrow, talentLayerService, talentLayerPlatformID, talentLayerReview]
}

const testCases = [
  {
    releasePercentage: 49,
    status: ServiceStatus.Uncompleted,
  },
  {
    releasePercentage: 50,
    status: ServiceStatus.Finished,
  },
]

describe('Completion of service', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerService: TalentLayerService,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerReview: TalentLayerReview

  before(async function () {
    ;[deployer, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerEscrow, talentLayerService, talentLayerPlatformID, talentLayerReview] =
      await deployAndSetup()

    // Deployer whitelists a list of authorized tokens
    await talentLayerService
      .connect(deployer)
      .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)
  })

  it('The owner can update the completion percentage', async function () {
    // Fails if caller is not the owner
    const tx = talentLayerService.connect(alice).updateMinCompletionPercentage(50)
    const adminRole = await talentLayerPlatformID.DEFAULT_ADMIN_ROLE()
    await expect(tx).to.be.revertedWith(
      `AccessControl: account ${alice.address.toLowerCase()} is missing role ${adminRole.toLowerCase()}`,
    )

    // Has success if caller is the owner
    await talentLayerService.connect(deployer).updateMinCompletionPercentage(50)
    expect(await talentLayerService.minCompletionPercentage()).to.equal(50)
  })

  for (const testCase of testCases) {
    describe('Service and review workflow', async function () {
      let transactionId: number
      let serviceId: number
      let serviceStatus: ServiceStatus

      before(async function () {
        const nonce = await talentLayerService.serviceNonce(aliceTlId)
        serviceId = (await talentLayerService.nextServiceId()).toNumber()

        // Alice, the buyer, initiates a new open service
        const signatureService = await getSignatureForService(
          carol,
          aliceTlId,
          nonce.toNumber(),
          cid,
        )
        await talentLayerService
          .connect(alice)
          .createService(aliceTlId, carolPlatformId, cid, signatureService, tokenAddress)

        // Bob, the seller, creates a proposal for the service
        const signatureProposal = await getSignatureForProposal(carol, bobTlId, serviceId, cid)
        await talentLayerService
          .connect(bob)
          .createProposal(
            bobTlId,
            serviceId,
            transactionAmount,
            carolPlatformId,
            cid,
            proposalExpirationDate,
            signatureProposal,
          )

        // Validate the proposal by locking the funds in the escrow
        const proposal = await talentLayerService.proposals(serviceId, bobTlId)
        const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
        const platform = await talentLayerPlatformID.platforms(carolPlatformId)
        const originServiceFeeRate = platform.originServiceFeeRate
        const originValidatedProposalFeeRate = platform.originValidatedProposalFeeRate
        const totalTransactionAmount = transactionAmount.add(
          transactionAmount
            .mul(protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)
            .div(feeDivider),
        )
        const tx = await talentLayerEscrow
          .connect(alice)
          .createTransaction(serviceId, proposalId, metaEvidenceCid, proposal.dataUri, {
            value: totalTransactionAmount,
          })

        // Get transaction id
        const receipt = await tx.wait()
        const event = receipt.events?.find((e) => e.event === 'TransactionCreated')
        transactionId = event?.args?.[0]
      })

      it('Service status is set correctly after full payment', async function () {
        // Release part of the payment to receiver
        const releaseAmount = transactionAmount.mul(testCase.releasePercentage).div(100)
        await talentLayerEscrow.connect(alice).release(aliceTlId, transactionId, releaseAmount)

        // Reimburse the rest to the seller
        const reimburseAmount = transactionAmount.sub(releaseAmount)
        await talentLayerEscrow.connect(bob).reimburse(bobTlId, transactionId, reimburseAmount)

        // Check service status
        const service = await talentLayerService.services(serviceId)
        serviceStatus = service.status
        expect(service.status).to.equal(testCase.status)
      })

      it('Review can be minted only if service is completed', async function () {
        if (serviceStatus === ServiceStatus.Finished) {
          // Can mint review if the service is finished
          const tx = talentLayerReview.connect(alice).mint(aliceTlId, serviceId, cid, 5)
          await expect(tx).to.not.be.reverted

          const tx2 = talentLayerReview.connect(bob).mint(bobTlId, serviceId, cid, 5)
          await expect(tx2).to.not.be.reverted
        } else {
          // Can't mint review if the service is uncompleted
          const tx = talentLayerReview.connect(alice).mint(aliceTlId, serviceId, cid, 5)
          await expect(tx).to.be.revertedWith('Service not finished yet')

          const tx2 = talentLayerReview.connect(bob).mint(bobTlId, serviceId, cid, 5)
          await expect(tx2).to.be.revertedWith('Service not finished yet')
        }
      })
    })
  }
})
