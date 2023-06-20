import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import {
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerEscrowV1,
  TalentLayerID,
  TalentLayerPlatformID,
  TalentLayerReview,
  TalentLayerService,
  TalentLayerServiceV1,
} from '../../../typechain-types'
import { NetworkConfig } from '../../../networkConfig'
import { ethers } from 'hardhat'
import { deployForV1, upgradeEscrowV1, upgradeServiceV1 } from '../../utils/deploy'
import { expect } from 'chai'
import {
  cid,
  metaEvidenceCid,
  minTokenWhitelistTransactionAmount,
  MintStatus,
  proposalExpirationDate,
} from '../../utils/constant'
import { Contract } from 'ethers'

const aliceTlId = 1
const bobTlId = 2
const carolTlId = 3
const daveTlId = 4

const alicePlatformId = 1

const rateAmount = 200000

const FEE_DIVIDER = 10000

// @dev: We are not testing signatures here, so we can use a fake signature
const fakeSignature =
  '0xea53f5cd3f7db698f2fdd38909c58fbd41fe35b54d5b0d6acc3b05555bae1f01795b86ea1d65d8c76954fd6cefd5c59c9c57274966a071be1ee3b783a123ff961b'

const alicePlatformProposalPostingFee = 0
describe('TalentLayer protocol global testing', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerServiceV1: TalentLayerServiceV1,
    talentLayerService: TalentLayerService,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerReview: TalentLayerReview,
    talentLayerEscrowV1: TalentLayerEscrowV1,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    token: SimpleERC20,
    platformName: string,
    platformId: string,
    mintFee: number,
    networkConfig: NetworkConfig,
    chainId: number

  const nonListedtoken = '0x6b175474e89094c44da98b954eedeac495271d0f'
  const referralAmount = 20000

  before(async function () {
    // Get the Signers
    ;[deployer, alice, bob, carol, dave] = await ethers.getSigners()
    ;[
      talentLayerID,
      talentLayerPlatformID,
      talentLayerEscrowV1,
      talentLayerArbitrator,
      talentLayerServiceV1,
      talentLayerReview,
      token,
    ] = await deployForV1()

    // Grant Platform Id Mint role to Deployer
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

    // we first check the actual minting status (should be ONLY_WHITELIST )
    const mintingStatus = await talentLayerPlatformID.connect(deployer).mintStatus()
    expect(mintingStatus).to.be.equal(1)
    // then we whitelist the deployer and Alice to mint a PlatformId for someone
    await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
    // we check if the deployer is well whitelisted
    const deployerWhitelisted = await talentLayerPlatformID.whitelist(deployer.address)
    expect(deployerWhitelisted).to.be.equal(true)

    // Deployer mints Platform Id for Alice
    platformName = 'rac00n-corp'
    await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, alice.address)
    mintFee = 100

    const allowedTokenList = ['0x0000000000000000000000000000000000000000', token.address]

    // Deployer whitelists a list of authorized tokens
    for (const tokenAddress of allowedTokenList) {
      await talentLayerServiceV1
        .connect(deployer)
        .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)
    }

    // Disable whitelist for reserved handles
    await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

    // Set service contract address on ID contract
    await talentLayerID.connect(deployer).setIsServiceContract(talentLayerServiceV1.address, true)

    // Mint TLIDs for all users
    await talentLayerID.connect(deployer).updateMintFee(0)
    await talentLayerID.connect(deployer).updateShortHandlesMaxPrice(0)
    await talentLayerID.connect(alice).mint('1', 'alice')
    await talentLayerID.connect(bob).mint('1', 'bob')
    await talentLayerID.connect(carol).mint('1', 'carol')
    await talentLayerID.connect(dave).mint('1', 'dave')

    // Transfers SimpleERC20 tokens to users
    await token.connect(deployer).transfer(alice.address, 10000000)
    await token.connect(deployer).transfer(bob.address, 10000000)
    await token.connect(deployer).transfer(dave.address, 10000000)
  })

  describe('Global contract tests', async function () {
    it('Alice owns a PlatformId Id minted by the deployer', async function () {
      platformId = (await talentLayerPlatformID.ids(alice.address)).toString()
      expect(platformId).to.be.equal('1')
    })
    it('All users have TLIDs', async function () {
      expect(await talentLayerID.ids(alice.address)).to.be.equal(aliceTlId)
      expect(await talentLayerID.ids(bob.address)).to.be.equal(bobTlId)
      expect(await talentLayerID.ids(carol.address)).to.be.equal(carolTlId)
      expect(await talentLayerID.ids(dave.address)).to.be.equal(daveTlId)
    })
  })

  describe('Service & Proposal creation tests - Before Upgrade', async function () {
    it('Users can freely create services without providing tokens', async function () {
      const platform = await talentLayerPlatformID.getPlatform(alicePlatformId)
      const alicePlatformServicePostingFee = platform.servicePostingFee
      // @dev: Signature not activated, will use the same signature for all services
      const tx = await talentLayerServiceV1
        .connect(alice)
        .createService(aliceTlId, alicePlatformId, cid, fakeSignature, {
          value: alicePlatformServicePostingFee,
        })

      const service1Data = await talentLayerServiceV1.services(1)
      expect(service1Data.dataUri).to.be.equal(cid)
      expect(service1Data.ownerId).to.be.equal(aliceTlId)
      expect(service1Data.platformId).to.be.equal(alicePlatformId)
      expect(service1Data.acceptedProposalId).to.be.equal(0)
      expect(service1Data.transactionId).to.be.equal(0)
      expect(service1Data.status).to.be.equal(0)
      expect(tx)
        .to.emit(talentLayerServiceV1, 'ServiceCreated')
        .withArgs(1, aliceTlId, alicePlatformId, cid)

      await talentLayerServiceV1
        .connect(bob)
        .createService(bobTlId, alicePlatformId, cid, fakeSignature, {
          value: alicePlatformServicePostingFee,
        })
      const service2Data = await talentLayerServiceV1.services(2)

      await talentLayerServiceV1
        .connect(carol)
        .createService(carolTlId, alicePlatformId, cid, fakeSignature, {
          value: alicePlatformServicePostingFee,
        })
      const service3Data = await talentLayerServiceV1.services(3)

      await talentLayerServiceV1
        .connect(dave)
        .createService(daveTlId, alicePlatformId, cid, fakeSignature, {
          value: alicePlatformServicePostingFee,
        })
      const service4Data = await talentLayerServiceV1.services(4)

      expect(service2Data.ownerId).to.be.equal(bobTlId)
      expect(service3Data.ownerId).to.be.equal(carolTlId)
      expect(service4Data.ownerId).to.be.equal(daveTlId)
    })
    it('Bob and dave can create 2 MATIC proposals for service 1. ', async function () {
      // Service1(alice): 2 proposals created, one validated MATIC, 25% released, 25% reimbursed
      //    ===> Need to release the rest + 100% reviews

      // Proposal 1
      const tx = await talentLayerServiceV1
        .connect(bob)
        .createProposal(
          bobTlId,
          1,
          ethers.constants.AddressZero,
          rateAmount,
          alicePlatformId,
          cid,
          proposalExpirationDate,
          fakeSignature,
          {
            value: alicePlatformProposalPostingFee,
          },
        )
      // Proposal 2
      await talentLayerServiceV1
        .connect(dave)
        .createProposal(
          daveTlId,
          1,
          ethers.constants.AddressZero,
          rateAmount,
          alicePlatformId,
          cid,
          proposalExpirationDate,
          fakeSignature,
          {
            value: alicePlatformProposalPostingFee,
          },
        )
    })

    it('Alice can validate proposal 1. 25% can be released & 25% reimbursed', async function () {
      const totalAmount = getTotalTransactionValue(
        talentLayerEscrowV1,
        talentLayerPlatformID,
        rateAmount,
      )

      // Transaction 1
      await talentLayerEscrowV1.connect(alice).createTransaction(1, bobTlId, metaEvidenceCid, cid, {
        value: totalAmount,
      })

      await talentLayerEscrowV1.connect(bob).reimburse(bobTlId, 1, rateAmount / 4)
      await talentLayerEscrowV1.connect(alice).release(aliceTlId, 1, rateAmount / 4)

      const transactionData = await talentLayerEscrowV1.connect(alice).getTransactionDetails(1)
      expect(transactionData.amount).to.be.equal(rateAmount / 2)
    })

    it('Alice can create 1 ERC20 proposal for service 1. ', async function () {
      // Service2(bob): 1 Proposal validated ERC20, 100% released, only buyer review sent
      //    ===> Need to 100% review

      // Proposal 3
      const tx = await talentLayerServiceV1
        .connect(alice)
        .createProposal(
          aliceTlId,
          2,
          token.address,
          rateAmount,
          alicePlatformId,
          cid,
          proposalExpirationDate,
          fakeSignature,
          {
            value: alicePlatformProposalPostingFee,
          },
        )
    })

    it('Bob can validate proposal 2 and release 100%', async function () {
      const totalAmount = getTotalTransactionValue(
        talentLayerEscrowV1,
        talentLayerPlatformID,
        rateAmount,
      )
      await token.connect(bob).approve(talentLayerEscrowV1.address, totalAmount)

      // Transaction 2
      await talentLayerEscrowV1.connect(bob).createTransaction(2, aliceTlId, metaEvidenceCid, cid)

      await talentLayerEscrowV1.connect(bob).release(bobTlId, 2, rateAmount)

      const transactionData = await talentLayerEscrowV1.connect(alice).getTransactionDetails(2)
      expect(transactionData.amount).to.be.equal(0)
    })

    it('Bob can review the transaction', async function () {
      await talentLayerReview.connect(bob).mint(bobTlId, 2, cid, 4)
      const review = await talentLayerReview.getReview(1)
      expect(review.id).to.be.equal(1)
      expect(review.ownerId).to.be.equal(aliceTlId)
      expect(review.dataUri).to.be.equal(cid)
      expect(review.serviceId).to.be.equal(2)
      expect(review.rating).to.be.equal(4)
    })

    it('Alice can create 1 ERC20 proposal for service 3. ', async function () {
      // Service3(Carol): 2 proposals created ERC20, none validated
      //    ===> Need to validate one + 100% release + 100% reviews

      // Proposal 4
      await talentLayerServiceV1
        .connect(alice)
        .createProposal(
          aliceTlId,
          3,
          token.address,
          rateAmount,
          alicePlatformId,
          cid,
          proposalExpirationDate,
          fakeSignature,
          {
            value: alicePlatformProposalPostingFee,
          },
        )
      await talentLayerServiceV1
        .connect(dave)
        .createProposal(
          daveTlId,
          3,
          token.address,
          rateAmount,
          alicePlatformId,
          cid,
          proposalExpirationDate,
          fakeSignature,
          {
            value: alicePlatformProposalPostingFee,
          },
        )
    })
    // Service4: Nothing
    //    ===> Need to create proposal after service creation, validate it, release 90%, reimburse 10% and review 100%
  })

  describe.only('Upgrade Service & Escrow contracts', async function () {
    it('Upgrade should not alter data', async function () {
      const service1DataBeforeUpgrade = await talentLayerServiceV1.services(1)
      const proposalDataBeforeUpgrade = await talentLayerServiceV1.getProposal(1, 1)
      talentLayerService = await upgradeServiceV1(talentLayerServiceV1.address)
      talentLayerEscrow = await upgradeEscrowV1(talentLayerEscrowV1.address)
      expect(talentLayerService.address).to.be.equal(talentLayerServiceV1.address)
      expect(talentLayerEscrow.address).to.be.equal(talentLayerEscrowV1.address)
      const service1DataAfterUpgrade = await talentLayerService.services(1)
      const proposalDataAfterUpgrade = await talentLayerService.getProposal(1, 1)
      expect(service1DataBeforeUpgrade.ownerId).to.be.equal(service1DataAfterUpgrade.ownerId)
      expect(service1DataBeforeUpgrade.dataUri).to.be.equal(service1DataAfterUpgrade.dataUri)
      expect(service1DataBeforeUpgrade.platformId).to.be.equal(service1DataAfterUpgrade.platformId)
      expect(service1DataBeforeUpgrade.acceptedProposalId).to.be.equal(
        service1DataAfterUpgrade.acceptedProposalId,
      )
      expect(service1DataAfterUpgrade.rateToken).to.be.equal(ethers.constants.AddressZero)

      expect(proposalDataBeforeUpgrade).to.be.deep.equal(proposalDataAfterUpgrade)
    })
  })
})

const getTotalTransactionValue = async (
  talentLayerEscrow: Contract,
  talentLayerPlatformID: Contract,
  rateAmount: number,
): Promise<number> => {
  const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
  const originServiceFeeRate = await talentLayerPlatformID.getOriginServiceFeeRate(alicePlatformId)
  const originValidatedProposalFeeRate =
    await talentLayerPlatformID.getOriginValidatedProposalFeeRate(alicePlatformId)

  return (
    rateAmount +
    (rateAmount * (protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)) /
      FEE_DIVIDER
  )
}
