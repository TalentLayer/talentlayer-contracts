import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerService, TalentLayerEscrow, TalentLayerPlatformID } from '../../typechain-types'
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
  [TalentLayerEscrow, TalentLayerService, TalentLayerPlatformID]
> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [talentLayerID, talentLayerPlatformID, talentLayerEscrow, , talentLayerService] =
    await deploy(true)

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Mint TL Id for Alice, Bob and Dave
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob__')

  return [talentLayerEscrow, talentLayerService, talentLayerPlatformID]
}

const testCases = [
  {
    releasePercentage: 30,
    status: ServiceStatus.Finished,
  },
  {
    releasePercentage: 29,
    status: ServiceStatus.Uncompleted,
  },
]

describe('Completion of service', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerService: TalentLayerService,
    talentLayerPlatformID: TalentLayerPlatformID

  before(async function () {
    ;[deployer, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerEscrow, talentLayerService, talentLayerPlatformID] = await deployAndSetup()

    // Deployer whitelists a list of authorized tokens
    await talentLayerService
      .connect(deployer)
      .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)
  })

  it('Service is marked as finished if released amount is over the completion percentage', async function () {
    for (const testCase of testCases) {
      const nonce = await talentLayerService.nonce(aliceTlId)
      const serviceId = await talentLayerService.nextServiceId()

      // Alice, the buyer, initiates a new open service
      const signatureService = await getSignatureForService(carol, aliceTlId, nonce.toNumber(), cid)
      await talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signatureService)

      // Bob, the seller, creates a proposal for the service
      const signatureProposal = await getSignatureForProposal(
        carol,
        bobTlId,
        serviceId.toNumber(),
        cid,
      )
      await talentLayerService
        .connect(bob)
        .createProposal(
          bobTlId,
          serviceId,
          tokenAddress,
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
      const transactionId = event?.args?.[0]

      // Release part of the payment to receiver
      const releaseAmount = transactionAmount.mul(testCase.releasePercentage).div(100)
      // const releaseAmount = ethers.utils.parseEther(testCase.releaseAmount.toString())
      await talentLayerEscrow.connect(alice).release(aliceTlId, transactionId, releaseAmount)

      // Reimburse the rest to the seller
      const reimburseAmount = transactionAmount.sub(releaseAmount)
      await talentLayerEscrow.connect(bob).reimburse(bobTlId, transactionId, reimburseAmount)

      // Check service status
      const service = await talentLayerService.services(serviceId)
      expect(service.status).to.equal(testCase.status)
    }
  })
})
