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
  metaEvidenceCid,
} from '../utils/constant'
import { deploy } from '../utils/deploy'
import { getSignatureForProposal, getSignatureForService } from '../utils/signature'

const aliceTlId = 1
const bobTlId = 2
const carolPlatformId = 1
const serviceId = 1
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

  // Deployer whitelists a list of authorized tokens
  await talentLayerService
    .connect(deployer)
    .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)

  // Alice, the buyer, initiates a new open service
  const signature = await getSignatureForService(carol, aliceTlId, 0, cid)
  await talentLayerService
    .connect(alice)
    .createService(aliceTlId, carolPlatformId, cid, signature, ethers.constants.AddressZero, 0)

  // Bob, the seller, creates a proposal for the service
  const signature2 = await getSignatureForProposal(carol, bobTlId, serviceId, cid)
  await talentLayerService
    .connect(bob)
    .createProposal(
      bobTlId,
      serviceId,
      transactionAmount,
      carolPlatformId,
      cid,
      proposalExpirationDate,
      signature2,
    )

  return [talentLayerEscrow, talentLayerService, talentLayerPlatformID, talentLayerReview]
}

describe('Pausable Escrow', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerService: TalentLayerService

  before(async function () {
    ;[deployer, alice] = await ethers.getSigners()
    ;[talentLayerEscrow, talentLayerService] = await deployAndSetup()
  })

  it('The owner can pause the escrow', async function () {
    // Fails if the caller is not the owner
    const tx = talentLayerEscrow.connect(alice).pause()
    expect(tx).to.revertedWith('Ownable: caller is not the owner')
    expect(await talentLayerEscrow.paused()).to.be.false

    // Success if the caller is the owner
    await talentLayerEscrow.connect(deployer).pause()
    expect(await talentLayerEscrow.paused()).to.be.true
  })

  it("A transaction can't be created when the escrow is paused", async function () {
    const proposal = await talentLayerService.proposals(serviceId, bobTlId)
    const tx = talentLayerEscrow
      .connect(alice)
      .createTransaction(serviceId, proposalId, metaEvidenceCid, proposal.dataUri, {
        value: transactionAmount,
      })

    expect(tx).to.revertedWith('Pausable: paused')
  })

  it('The owner can unpause the escrow', async function () {
    // Fails if the caller is not the owner
    const tx = talentLayerEscrow.connect(alice).unpause()
    expect(tx).to.revertedWith('Ownable: caller is not the owner')
    expect(await talentLayerEscrow.paused()).to.be.true

    // Success if the caller is the owner
    await talentLayerEscrow.connect(deployer).unpause()
    expect(await talentLayerEscrow.paused()).to.be.false
  })

  it('A transaction can be created when the escrow is unpaused', async function () {
    const proposal = await talentLayerService.proposals(serviceId, bobTlId)
    const tx = talentLayerEscrow
      .connect(alice)
      .createTransaction(serviceId, proposalId, metaEvidenceCid, proposal.dataUri, {
        value: transactionAmount,
      })

    expect(tx).to.not.be.reverted
  })
})
