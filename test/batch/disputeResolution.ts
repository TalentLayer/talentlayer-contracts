import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Bytes } from 'ethers'
import { ethers } from 'hardhat'
import {
  MockProofOfHumanity,
  ServiceRegistry,
  TalentLayerArbitrator,
  TalentLayerID,
  TalentLayerEscrow,
  TalentLayerPlatformID,
} from '../../typechain-types'

// TODO: remove "only"
describe.only('Dispute Resolution', () => {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    serviceRegistry: ServiceRegistry,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    mockProofOfHumanity: MockProofOfHumanity

  const aliceTlId = 1
  const bobTlId = 2
  const carolPlatformId = 1
  const serviceId = 1
  const serviceAmount = 100
  const proposalId = bobTlId
  const transactionId = 0
  const ethAddress = '0x0000000000000000000000000000000000000000'
  const arbitratorExtraData: Bytes = []
  const arbitrationCost = ethers.utils.parseEther('0.001')
  const disputeId = 0

  before(async function () {
    ;[deployer, alice, bob, carol] = await ethers.getSigners()

    // Deploy MockProofOfHumanity
    const MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
    mockProofOfHumanity = await MockProofOfHumanity.deploy()

    // Deploy PlatformId
    const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
    talentLayerPlatformID = await TalentLayerPlatformID.deploy()

    // Deploy TalenLayerID
    const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
    const talentLayerIDArgs: [string, string] = [mockProofOfHumanity.address, talentLayerPlatformID.address]
    talentLayerID = (await TalentLayerID.deploy(...talentLayerIDArgs)) as TalentLayerID

    // Deploy ServiceRegistry
    const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
    const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
    serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs)

    // Deploy TalentLayerArbitrator
    const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
    talentLayerArbitrator = await TalentLayerArbitrator.deploy(arbitrationCost, talentLayerPlatformID.address)

    // Deploy TalentLayerEscrow
    const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
    talentLayerEscrow = await TalentLayerEscrow.deploy(
      serviceRegistry.address,
      talentLayerID.address,
      talentLayerPlatformID.address,
    )

    // Grant escrow role
    const escrowRole = await serviceRegistry.ESCROW_ROLE()
    await serviceRegistry.grantRole(escrowRole, talentLayerEscrow.address)

    // Grant Platform Id Mint role to Deployer and Bob
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

    // Deployer mints Platform Id for Carol
    const platformName = 'HireVibes'
    await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

    // Update platform arbitrator, extra data and fee timeout
    await talentLayerPlatformID.connect(carol).updateArbitrator(carolPlatformId, talentLayerArbitrator.address)
    await talentLayerPlatformID.connect(carol).updateArbitratorExtraData(carolPlatformId, arbitratorExtraData)
    await talentLayerPlatformID.connect(carol).updateArbitrationFeeTimeout(carolPlatformId, 3600 * 1)

    // Mint TL Id for Alice and Bob
    await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
    await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

    // Alice, the buyer, initiates a new open service with Bob
    await serviceRegistry.connect(alice).createOpenServiceFromBuyer(carolPlatformId, 'cid')

    // Bob creates a proposal for the service
    await serviceRegistry.connect(bob).createProposal(serviceId, ethAddress, serviceAmount, 'cid')
  })

  describe('When a transaction is created', async function () {
    let aliceBalanceBefore: BigNumber
    let escrowBalanceBefore: BigNumber
    let totalTransactionAmount: number
    let gasUsed: BigNumber

    before(async function () {
      aliceBalanceBefore = await alice.getBalance()
      escrowBalanceBefore = await ethers.provider.getBalance(talentLayerEscrow.address)

      const protocolFee = await talentLayerEscrow.protocolFee()
      const originPlatformFee = await talentLayerEscrow.originPlatformFee()
      const platformFee = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
      totalTransactionAmount = serviceAmount + (serviceAmount * (protocolFee + originPlatformFee + platformFee)) / 10000

      const tx = await talentLayerEscrow.connect(alice).createETHTransaction('_metaEvidence', serviceId, proposalId, {
        value: totalTransactionAmount,
      })
      const receipt = await tx.wait()
      gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    })

    it('Alice balance decreases by the amount of the transaction', async function () {
      const aliceBalanceAfter = await alice.getBalance()
      expect(aliceBalanceAfter).to.be.eq(aliceBalanceBefore.sub(totalTransactionAmount).sub(gasUsed))
    })

    it('Escrow balance increases by the amount of the transaction', async function () {
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerEscrow.address)
      expect(contractBalanceAfter).to.be.eq(escrowBalanceBefore.add(totalTransactionAmount))
    })
  })

  describe('When the buyer releases a partial payment to the seller', async function () {
    let bobBalanceBefore: BigNumber
    let escrowBalanceBefore: BigNumber
    const releasedAmount = 10

    before(async function () {
      bobBalanceBefore = await bob.getBalance()
      escrowBalanceBefore = await ethers.provider.getBalance(talentLayerEscrow.address)

      await talentLayerEscrow.connect(alice).release(transactionId, releasedAmount)
    })

    it('Bob balance increases by the amount released', async function () {
      const bobBalanceAfter = await bob.getBalance()
      expect(bobBalanceAfter).to.be.eq(bobBalanceBefore.add(releasedAmount))
    })

    it('Escrow balance decreases by the amount released', async function () {
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerEscrow.address)
      expect(contractBalanceAfter).to.be.eq(escrowBalanceBefore.sub(releasedAmount))
    })
  })

  describe('When the sender pays the arbitration fee', async function () {
    let aliceBalanceBefore: BigNumber
    let escrowBalanceBefore: BigNumber
    let gasUsed: BigNumber

    before(async function () {
      aliceBalanceBefore = await alice.getBalance()
      escrowBalanceBefore = await ethers.provider.getBalance(talentLayerEscrow.address)

      const tx = await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost,
      })
      const receipt = await tx.wait()
      gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    })

    it('Alice balance decreases by the arbitration cost', async function () {
      const aliceBalanceAfter = await alice.getBalance()
      expect(aliceBalanceAfter).to.be.eq(aliceBalanceBefore.sub(arbitrationCost).sub(gasUsed))
    })

    it('Escrow balance increases by the arbitration cost', async function () {
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerEscrow.address)
      expect(contractBalanceAfter).to.be.eq(escrowBalanceBefore.add(arbitrationCost))
    })

    it('The fee paid by sender increases by the arbitration cost', async function () {
      const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
      expect(transaction.senderFee).to.be.eq(arbitrationCost)
    })

    it('The transaction status becomes "WaitingReceiver"', async function () {
      const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(2)
    })
  })

  describe('When the receiver pays the arbitration fee', async function () {
    let bobBalanceBefore: BigNumber
    let escrowBalanceBefore: BigNumber
    let arbitratorBalanceBefore: BigNumber
    let gasUsed: BigNumber

    before(async function () {
      bobBalanceBefore = await bob.getBalance()
      escrowBalanceBefore = await ethers.provider.getBalance(talentLayerEscrow.address)
      arbitratorBalanceBefore = await ethers.provider.getBalance(talentLayerArbitrator.address)

      const tx = await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
        value: arbitrationCost,
      })
      const receipt = await tx.wait()
      gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    })

    it('Bob balance decreases by the arbitration cost', async function () {
      const bobBalanceAfter = await bob.getBalance()
      expect(bobBalanceAfter).to.be.eq(bobBalanceBefore.sub(arbitrationCost).sub(gasUsed))
    })

    it('Escrow balance remains the same', async function () {
      const escrowBalanceAfter = await ethers.provider.getBalance(talentLayerEscrow.address)
      expect(escrowBalanceAfter).to.be.eq(escrowBalanceBefore)
    })

    it('Arbitrator balance increases by the arbitration cost', async function () {
      const arbitratorBalanceAfter = await ethers.provider.getBalance(talentLayerArbitrator.address)
      expect(arbitratorBalanceAfter).to.be.eq(arbitratorBalanceBefore.add(arbitrationCost))
    })

    it('The fee paid by sender increases by the arbitration cost', async function () {
      const transaction = await talentLayerEscrow.connect(bob).getTransactionDetails(transactionId)
      expect(transaction.receiverFee).to.be.eq(arbitrationCost)
    })

    it('The transaction status becomes "DisputeCreated"', async function () {
      const transaction = await talentLayerEscrow.connect(bob).getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(3)
    })

    it('A dispute is created, with the correct data', async function () {
      const dispute = await talentLayerArbitrator.disputes(0)
      expect(dispute.arbitrated).to.be.eq(talentLayerEscrow.address)
      expect(dispute.fee).to.be.eq(arbitrationCost)
      expect(dispute.platformId).to.be.eq(carolPlatformId)
    })
  })
})
