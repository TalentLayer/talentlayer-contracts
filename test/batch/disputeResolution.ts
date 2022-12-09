import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, Bytes, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import { TalentLayerArbitrator, TalentLayerEscrow, TalentLayerPlatformID } from '../../typechain-types'

enum TransactionStatus {
  NoDispute,
  WaitingSender,
  WaitingReceiver,
  DisputeCreated,
  Resolved,
}

const bobTlId = 2
const carolPlatformId = 1
const serviceId = 1
const proposalId = bobTlId
const transactionId = 0
const transactionAmount = BigNumber.from(1000)
const ethAddress = '0x0000000000000000000000000000000000000000'
const arbitratorExtraData: Bytes = []
const arbitrationCost = BigNumber.from(10)
const disputeId = 0
const metaEvidence = 'metaEvidence'
const feeDivider = 10000

/**
 * Deploys contract and sets up the context for dispute resolution.
 * @param arbitrationFeeTimeout the timeout for the arbitration fee
 * @returns the deployed contracts
 */
async function deployAndSetup(
  arbitrationFeeTimeout: number,
): Promise<[TalentLayerPlatformID, TalentLayerEscrow, TalentLayerArbitrator]> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()

  // Deploy MockProofOfHumanity
  const MockProofOfHumanity = await ethers.getContractFactory('MockProofOfHumanity')
  const mockProofOfHumanity = await MockProofOfHumanity.deploy()

  // Deploy PlatformId
  const TalentLayerPlatformID = await ethers.getContractFactory('TalentLayerPlatformID')
  const talentLayerPlatformID = await TalentLayerPlatformID.deploy()

  // Deploy TalenLayerID
  const TalentLayerID = await ethers.getContractFactory('TalentLayerID')
  const talentLayerIDArgs: [string, string] = [mockProofOfHumanity.address, talentLayerPlatformID.address]
  const talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)

  // Deploy ServiceRegistry
  const ServiceRegistry = await ethers.getContractFactory('ServiceRegistry')
  const serviceRegistryArgs: [string, string] = [talentLayerID.address, talentLayerPlatformID.address]
  const serviceRegistry = await ServiceRegistry.deploy(...serviceRegistryArgs)

  // Deploy TalentLayerArbitrator
  const TalentLayerArbitrator = await ethers.getContractFactory('TalentLayerArbitrator')
  const talentLayerArbitrator = await TalentLayerArbitrator.deploy(arbitrationCost, talentLayerPlatformID.address)

  // Deploy TalentLayerEscrow
  const TalentLayerEscrow = await ethers.getContractFactory('TalentLayerEscrow')
  const talentLayerEscrow = await TalentLayerEscrow.deploy(
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
  await talentLayerPlatformID.connect(carol).updateArbitrationFeeTimeout(carolPlatformId, arbitrationFeeTimeout)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob')

  // Alice, the buyer, initiates a new open service
  await serviceRegistry.connect(alice).createOpenServiceFromBuyer(carolPlatformId, 'cid')

  // Bob, the seller, creates a proposal for the service
  await serviceRegistry.connect(bob).createProposal(serviceId, ethAddress, transactionAmount, 'cid')

  return [talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator]
}

// TODO: remove "only"
describe('Dispute Resolution, standard flow', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    protocolFee: number,
    originPlatformFee: number,
    platformFee: number

  const transactionReleasedAmount = BigNumber.from(100)
  const transactionReimbursedAmount = BigNumber.from(50)
  let currentTransactionAmount = transactionAmount
  const rulingId = 1

  before(async function () {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator] = await deployAndSetup(3600)
  })

  describe('Transaction creation', async function () {
    let totalTransactionAmount: BigNumber
    let tx: ContractTransaction

    before(async function () {
      protocolFee = await talentLayerEscrow.protocolFee()
      originPlatformFee = await talentLayerEscrow.originPlatformFee()
      platformFee = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
      totalTransactionAmount = transactionAmount.add(
        transactionAmount.mul(protocolFee + originPlatformFee + platformFee).div(feeDivider),
      )

      tx = await talentLayerEscrow.connect(alice).createETHTransaction(metaEvidence, serviceId, proposalId, {
        value: totalTransactionAmount,
      })
    })

    it('Funds are sent from buyer (Alice) to the escrow', async function () {
      await expect(tx).to.changeEtherBalances(
        [alice.address, talentLayerEscrow.address],
        [-totalTransactionAmount, totalTransactionAmount],
      )
    })

    it('MetaEvidence is submitted', async function () {
      await expect(tx).to.emit(talentLayerEscrow, 'MetaEvidence').withArgs(transactionId, metaEvidence)
    })
  })

  describe('Partial release/reimbursement before a dispute', async function () {
    it('On release funds are sent from escrow to seller (Bob)', async function () {
      const tx = await talentLayerEscrow.connect(alice).release(transactionId, transactionReleasedAmount)
      await expect(tx).to.changeEtherBalances(
        [bob.address, talentLayerEscrow.address],
        [transactionReleasedAmount, -transactionReleasedAmount],
      )

      currentTransactionAmount = currentTransactionAmount.sub(transactionReleasedAmount)
    })

    it('On reimbursement funds and fees are sent from escrow to buyer (Alice)', async function () {
      const reimbursedFees = transactionReimbursedAmount
        .mul(protocolFee + originPlatformFee + platformFee)
        .div(feeDivider)
      const totalReimbursedAmount = transactionReimbursedAmount.add(reimbursedFees)

      const tx = await talentLayerEscrow.connect(bob).reimburse(transactionId, transactionReimbursedAmount)
      await expect(tx).to.changeEtherBalances(
        [alice.address, talentLayerEscrow.address],
        [totalReimbursedAmount, -totalReimbursedAmount],
      )

      currentTransactionAmount = currentTransactionAmount.sub(transactionReimbursedAmount)
    })
  })

  describe('Payment of arbitration fee by first party (sender in this case)', async function () {
    it('Fails if is not called by the sender of the transaction', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith('The caller must be the sender.')
    })

    it('Fails if the amount of ETH sent is less than the arbitration cost', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost.sub(1),
      })
      await expect(tx).to.be.revertedWith('The sender fee must cover arbitration costs.')
    })

    describe('Successfull payment of arbitration fee', async function () {
      let tx: ContractTransaction

      before(async function () {
        tx = await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
          value: arbitrationCost,
        })
      })

      it('Arbitration fee is sent from sender (Alice) to escrow', async function () {
        await expect(tx).to.changeEtherBalances(
          [alice.address, talentLayerEscrow.address],
          [-arbitrationCost, arbitrationCost],
        )
      })

      it('The fee amount paid by the sender is stored in the transaction', async function () {
        const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
        expect(transaction.senderFee).to.be.eq(arbitrationCost)
      })

      it('The transaction status becomes "WaitingReceiver"', async function () {
        const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.WaitingReceiver)
      })
    })
  })

  describe('Attempt to end dispute before arbitration fee timeout has passed', async function () {
    it('Fails if is not called by the sender of the transaction', async function () {
      const tx = talentLayerEscrow.connect(alice).timeOutBySender(transactionId)
      await expect(tx).to.be.revertedWith('Timeout time has not passed yet.')
    })
  })

  describe('Payment of arbitration fee by second party (receiver in this case) and creation of dispute', async function () {
    it('Fails if is not called by the receiver of the transaction', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeByReceiver(transactionId, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith('The caller must be the receiver.')
    })

    it('Fails if the amount of ETH sent is less than the arbitration cost', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
        value: arbitrationCost.sub(1),
      })
      await expect(tx).to.be.revertedWith('The receiver fee must cover arbitration costs.')
    })

    describe('Successfull payment of arbitration fee', async function () {
      let tx: ContractTransaction

      before(async function () {
        tx = await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
          value: arbitrationCost,
        })
      })

      it('The arbitration fee is sent to the arbitrator', async function () {
        await expect(tx).to.changeEtherBalances(
          [bob.address, talentLayerEscrow.address, talentLayerArbitrator.address],
          [-arbitrationCost, 0, arbitrationCost],
        )
      })

      it('The fee amount paid by the receiver is stored in the transaction', async function () {
        const transaction = await talentLayerEscrow.connect(bob).getTransactionDetails(transactionId)
        expect(transaction.receiverFee).to.be.eq(arbitrationCost)
      })

      it('The transaction status becomes "DisputeCreated"', async function () {
        const transaction = await talentLayerEscrow.connect(bob).getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.DisputeCreated)
      })

      it('A dispute is created, with the correct data', async function () {
        const dispute = await talentLayerArbitrator.disputes(disputeId)
        expect(dispute.arbitrated).to.be.eq(talentLayerEscrow.address)
        expect(dispute.fee).to.be.eq(arbitrationCost)
        expect(dispute.platformId).to.be.eq(carolPlatformId)
      })
    })
  })

  describe('Attempt to release/reimburse after a dispute', async function () {
    it('Release fails since ther must be no dispute to release', async function () {
      const tx = talentLayerEscrow.connect(alice).release(transactionId, transactionReleasedAmount)
      await expect(tx).to.be.revertedWith("The transaction shouldn't be disputed.")
    })

    it('Reimbursement fails since ther must be no dispute to reimburse', async function () {
      const tx = talentLayerEscrow.connect(bob).reimburse(transactionId, transactionReimbursedAmount)
      await expect(tx).to.be.revertedWith("The transaction shouldn't be disputed.")
    })
  })

  describe('Submission of Evidence', async function () {
    it('Fails if evidence is not submitted by either sender or receiver of the transaction', async function () {
      const daveEvidence = "Dave's evidence"
      const tx = talentLayerEscrow.connect(dave).submitEvidence(transactionId, daveEvidence)
      await expect(tx).to.be.revertedWith('The caller must be the sender or the receiver.')
    })

    it('The evidence event is emitted when the sender submits it', async function () {
      const aliceEvidence = "Alice's evidence"
      const tx = await talentLayerEscrow.connect(alice).submitEvidence(transactionId, aliceEvidence)
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Evidence')
        .withArgs(talentLayerArbitrator.address, transactionId, alice.address, aliceEvidence)
    })

    it('The evidence event is emitted when the receiver submits it', async function () {
      const bobEvidence = "Bob's evidence"
      const tx = await talentLayerEscrow.connect(bob).submitEvidence(transactionId, bobEvidence)
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Evidence')
        .withArgs(talentLayerArbitrator.address, transactionId, bob.address, bobEvidence)
    })
  })

  describe('Submission of a ruling', async function () {
    it('Fails if ruling is not given by the arbitrator contract', async function () {
      const tx = talentLayerEscrow.connect(dave).rule(disputeId, rulingId)
      await expect(tx).to.be.revertedWith('The caller must be the arbitrator.')
    })

    it('Fails if ruling is not given by the platform owner', async function () {
      const tx = talentLayerArbitrator.connect(dave).giveRuling(disputeId, rulingId)
      await expect(tx).to.be.revertedWith('Only the owner of the platform can give a ruling')
    })

    describe('Successfull submission of a ruling', async function () {
      let tx: ContractTransaction

      before(async function () {
        // Rule in favor of the sender (Alice)
        tx = await talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)
      })

      it('The winner of the dispute (Alice) receives escrow funds and gets arbitration fee reimbursed', async function () {
        const sentAmount = currentTransactionAmount.add(arbitrationCost)
        await expect(tx).to.changeEtherBalances([alice.address, talentLayerEscrow.address], [sentAmount, -sentAmount])
      })

      it('The owner of the platform (Carol) receives the arbitration fee', async function () {
        await expect(tx).to.changeEtherBalances(
          [carol.address, talentLayerArbitrator.address],
          [arbitrationCost, -arbitrationCost],
        )
      })

      it('The status of the transaction becomes "Resolved"', async function () {
        const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
      })

      it('Dispute data is updated', async function () {
        const dispute = await talentLayerArbitrator.connect(alice).disputes(transactionId)
        expect(dispute.status).to.be.eq(2)
        expect(dispute.ruling).to.be.eq(rulingId)
      })
    })
  })
})

describe('Dispute Resolution, with party failing to pay arbitration fee on time', function () {
  let alice: SignerWithAddress, talentLayerPlatformID: TalentLayerPlatformID, talentLayerEscrow: TalentLayerEscrow

  before(async function () {
    ;[, alice] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow] = await deployAndSetup(1)

    // Create transaction
    const protocolFee = await talentLayerEscrow.protocolFee()
    const originPlatformFee = await talentLayerEscrow.originPlatformFee()
    const platformFee = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
    const totalTransactionAmount = transactionAmount.add(
      transactionAmount.mul(protocolFee + originPlatformFee + platformFee).div(feeDivider),
    )
    await talentLayerEscrow.connect(alice).createETHTransaction(metaEvidence, serviceId, proposalId, {
      value: totalTransactionAmount,
    })

    // Alice wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: arbitrationCost,
    })
  })

  describe('One party (in our case receiver) fails to pay arbitration fee on time', function () {
    let tx: ContractTransaction

    before(async function () {
      tx = await talentLayerEscrow.connect(alice).timeOutBySender(transactionId)
    })

    it('The sender wins the dispute (Alice) receives escrow funds and gets arbitration fee reimbursed', async function () {
      const sentAmount = transactionAmount.add(arbitrationCost)
      await expect(tx).to.changeEtherBalances([alice.address, talentLayerEscrow.address], [sentAmount, -sentAmount])
    })

    it('The status of the transaction becomes "Resolved"', async function () {
      const transaction = await talentLayerEscrow.connect(alice).getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
    })
  })
})

describe('Dispute Resolution, arbitrator abstaing from giving a ruling', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator

  before(async function () {
    ;[, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator] = await deployAndSetup(1)

    // Create transaction
    const protocolFee = await talentLayerEscrow.protocolFee()
    const originPlatformFee = await talentLayerEscrow.originPlatformFee()
    const platformFee = (await talentLayerPlatformID.platforms(carolPlatformId)).fee
    const totalTransactionAmount = transactionAmount.add(
      transactionAmount.mul(protocolFee + originPlatformFee + platformFee).div(feeDivider),
    )
    await talentLayerEscrow.connect(alice).createETHTransaction(metaEvidence, serviceId, proposalId, {
      value: totalTransactionAmount,
    })

    // Alice wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: arbitrationCost,
    })

    // Bob pays the arbitration fee and a dispute is created
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: arbitrationCost,
    })
  })

  describe('The arbitrator abstains form giving a ruling', async function () {
    let tx: ContractTransaction

    before(async function () {
      tx = await talentLayerArbitrator.connect(carol).giveRuling(transactionId, 0)
    })

    it('Split funds and arbitration fee half and half between the parties', async function () {
      const halfAmount = transactionAmount.add(arbitrationCost).div(2)
      await expect(tx).to.changeEtherBalances(
        [alice.address, bob.address, talentLayerEscrow.address],
        [halfAmount, halfAmount, -transactionAmount.add(arbitrationCost)],
      )
    })
  })
})
