import { time } from '@nomicfoundation/hardhat-network-helpers'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { BigNumber, ContractTransaction } from 'ethers'
import { ethers } from 'hardhat'
import {
  TalentLayerService,
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerPlatformID,
} from '../../typechain-types'
import {
  TransactionStatus,
  DisputeStatus,
  PaymentType,
  MintStatus,
  minTokenWhitelistTransactionAmount,
  cid,
  proposalExpirationDate,
  arbitrationFeeTimeout,
  feeDivider,
  metaEvidenceCid,
  evidenceCid,
  ServiceStatus,
  ethAddress,
} from '../utils/constant'
import { deploy } from '../utils/deploy'
import { getSignatureForProposal, getSignatureForService } from '../utils/signature'

const aliceTlId = 1
const bobTlId = 2
const daveTlId = 3
const carolPlatformId = 1
const serviceId = 1
const proposalId = bobTlId
const transactionId = 1
const transactionAmount = BigNumber.from(1000000)
const arbitrationCost = BigNumber.from(10)
const disputeId = 0

/**
 * Deploys contract and sets up the context for dispute resolution.
 * @param arbitrationFeeTimeout the timeout for the arbitration fee
 * @param tokenAddress the payment token used for this case
 * @returns the deployed contracts
 */
async function deployAndSetup(
  arbitrationFeeTimeout: number,
  tokenAddress: string,
): Promise<[TalentLayerPlatformID, TalentLayerEscrow, TalentLayerArbitrator, TalentLayerService]> {
  const [deployer, alice, bob, carol, dave] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    talentLayerService,
  ] = await deploy(false)

  // Deployer whitelists a list of authorized tokens
  await talentLayerService
    .connect(deployer)
    .updateAllowedTokenList(tokenAddress, true, minTokenWhitelistTransactionAmount)

  // Grant Platform Id Mint role to Deployer and Bob
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)

  // Deployer mints Platform Id for Carol
  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  // Add arbitrator to platform available arbitrators
  await talentLayerPlatformID.connect(deployer).addArbitrator(talentLayerArbitrator.address, true)

  // Update platform arbitrator, and fee timeout
  await talentLayerPlatformID
    .connect(carol)
    .updateArbitrator(carolPlatformId, talentLayerArbitrator.address, [])
  await talentLayerPlatformID
    .connect(carol)
    .updateArbitrationFeeTimeout(carolPlatformId, arbitrationFeeTimeout)

  // Update arbitration cost
  await talentLayerArbitrator.connect(carol).setArbitrationPrice(carolPlatformId, arbitrationCost)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Set service contract address on ID contract
  await talentLayerID.connect(deployer).setIsServiceContract(talentLayerService.address, true)

  // Mint TL Id for Alice, Bob and Dave
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob__')
  await talentLayerID.connect(dave).mint(carolPlatformId, 'dave_')

  // Alice, the buyer, initiates a new open service
  const signature = await getSignatureForService(carol, aliceTlId, 0, cid)
  await talentLayerService
    .connect(alice)
    .createService(aliceTlId, carolPlatformId, cid, signature, tokenAddress, 0)

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
      0,
    )

  return [talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService]
}

async function getTransactionDetails(
  talentLayerPlatformID: TalentLayerPlatformID,
  talentLayerEscrow: TalentLayerEscrow,
): Promise<[BigNumber, number, number, number]> {
  const platform = await talentLayerPlatformID.platforms(carolPlatformId)
  const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
  const originServiceFeeRate = platform.originServiceFeeRate
  const originValidatedProposalFeeRate = platform.originValidatedProposalFeeRate
  const totalTransactionAmount = transactionAmount.add(
    transactionAmount
      .mul(protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)
      .div(feeDivider),
  )

  return [
    totalTransactionAmount,
    protocolEscrowFeeRate,
    originServiceFeeRate,
    originValidatedProposalFeeRate,
  ]
}

async function createTransaction(
  talentLayerPlatformID: TalentLayerPlatformID,
  talentLayerEscrow: TalentLayerEscrow,
  talentLayerService: TalentLayerService,
  signer: SignerWithAddress,
  tokenAddress: string,
): Promise<[ContractTransaction, BigNumber, number, number, number]> {
  // Create transaction
  const [
    totalTransactionAmount,
    protocolEscrowFeeRate,
    originServiceFeeRate,
    originValidatedProposalFeeRate,
  ] = await getTransactionDetails(talentLayerPlatformID, talentLayerEscrow)

  // we need to retreive the Bob proposal dataUri
  const proposal = await talentLayerService.proposals(serviceId, bobTlId)
  const value = proposal.rateToken === ethAddress ? totalTransactionAmount : 0

  let tx: ContractTransaction
  tokenAddress === ethAddress
    ? (tx = await talentLayerEscrow
        .connect(signer)
        .createTransaction(serviceId, proposalId, metaEvidenceCid, proposal.dataUri, {
          value,
        }))
    : (tx = await talentLayerEscrow
        .connect(signer)
        .createTransaction(serviceId, proposalId, metaEvidenceCid, proposal.dataUri))

  return [
    tx,
    totalTransactionAmount,
    protocolEscrowFeeRate,
    originServiceFeeRate,
    originValidatedProposalFeeRate,
  ]
}

describe('Dispute Resolution, standard flow', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerService: TalentLayerService,
    protocolEscrowFeeRate: number,
    originServiceFeeRate: number,
    originValidatedProposalFeeRate: number,
    platform: TalentLayerPlatformID.PlatformStructOutput

  const transactionReleasedAmount = BigNumber.from(100000)
  const transactionReimbursedAmount = BigNumber.from(50000)
  let currentTransactionAmount = transactionAmount
  const rulingId = 1
  const newArbitrationCost = BigNumber.from(8)
  const arbitrationCostDifference = arbitrationCost.sub(newArbitrationCost)

  before(async function () {
    ;[, alice, bob, carol, dave] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, ethers.constants.AddressZero)

    protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
    platform = await talentLayerPlatformID.platforms(carolPlatformId)
    originServiceFeeRate = platform.originServiceFeeRate
    originValidatedProposalFeeRate = platform.originValidatedProposalFeeRate
  })

  describe('Transaction creation', async function () {
    let totalTransactionAmount: BigNumber
    let tx: ContractTransaction

    before(async function () {
      // Create transaction
      ;[
        tx,
        totalTransactionAmount,
        protocolEscrowFeeRate,
        originServiceFeeRate,
        originValidatedProposalFeeRate,
      ] = await createTransaction(
        talentLayerPlatformID,
        talentLayerEscrow,
        talentLayerService,
        alice,
        ethAddress,
      )
    })

    it('Funds are sent from buyer (Alice) to the escrow', async function () {
      await expect(tx).to.changeEtherBalances(
        [alice.address, talentLayerEscrow.address],
        [-totalTransactionAmount, totalTransactionAmount],
      )
    })

    it('MetaEvidence is submitted', async function () {
      await expect(tx)
        .to.emit(talentLayerEscrow, 'MetaEvidence')
        .withArgs(transactionId, metaEvidenceCid)
    })

    it('Transaction is created', async function () {
      await expect(tx)
        .to.emit(talentLayerEscrow, 'TransactionCreated')
        .withArgs(
          transactionId,
          aliceTlId,
          bobTlId,
          ethers.constants.AddressZero,
          transactionAmount,
          serviceId,
          proposalId,
          protocolEscrowFeeRate,
          originServiceFeeRate,
          originValidatedProposalFeeRate,
          talentLayerArbitrator.address,
          platform.arbitratorExtraData,
          arbitrationFeeTimeout,
        )
    })
  })

  describe('Partial release/reimbursement before a dispute', async function () {
    it('On release funds are sent from escrow to seller (Bob)', async function () {
      const tx = await talentLayerEscrow
        .connect(alice)
        .release(aliceTlId, transactionId, transactionReleasedAmount)
      await expect(tx).to.changeEtherBalances(
        [bob.address, talentLayerEscrow.address],
        [transactionReleasedAmount, -transactionReleasedAmount],
      )

      currentTransactionAmount = currentTransactionAmount.sub(transactionReleasedAmount)
    })

    it('On reimbursement funds and fees are sent from escrow to buyer (Alice)', async function () {
      const reimbursedFees = transactionReimbursedAmount
        .mul(protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)
        .div(feeDivider)
      const totalReimbursedAmount = transactionReimbursedAmount.add(reimbursedFees)

      const tx = await talentLayerEscrow
        .connect(bob)
        .reimburse(bobTlId, transactionId, transactionReimbursedAmount)
      await expect(tx).to.changeEtherBalances(
        [alice.address, talentLayerEscrow.address],
        [totalReimbursedAmount, -totalReimbursedAmount],
      )

      currentTransactionAmount = currentTransactionAmount.sub(transactionReimbursedAmount)
    })
  })

  describe('Payment of arbitration fee by first party (sender in this case)', async function () {
    it('Fails if the transaction does not have an arbitrator set', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeBySender(0, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith('Arbitrator not set')
    })

    it('Fails if is not called by the sender of the transaction', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith('The caller must be the sender')
    })

    it('Fails if the amount of ETH sent is less than the arbitration cost', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost.sub(1),
      })
      await expect(tx).to.be.revertedWith('The sender fee must be equal to the arbitration cost')
    })

    describe('Successful payment of arbitration fee', async function () {
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
        const transaction = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId)
        expect(transaction.senderFee).to.be.eq(arbitrationCost)
      })

      it('The transaction status becomes "WaitingReceiver"', async function () {
        const transaction = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.WaitingReceiver)
      })
    })
  })

  describe('Attempt to end dispute before arbitration fee timeout has passed', async function () {
    it('Fails if is not called by the sender of the transaction', async function () {
      const tx = talentLayerEscrow.connect(alice).arbitrationFeeTimeout(transactionId)
      await expect(tx).to.be.revertedWith('Timeout time has not passed yet')
    })
  })

  describe('Payment of arbitration fee by second party (receiver in this case) and creation of dispute', async function () {
    before(async function () {
      // Carol decreases arbitration fee on arbitrator
      await talentLayerArbitrator
        .connect(carol)
        .setArbitrationPrice(carolPlatformId, newArbitrationCost)
    })

    it('Fails if the transaction does not have an arbitrator set', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(0, {
        value: newArbitrationCost,
      })
      await expect(tx).to.be.revertedWith('Arbitrator not set')
    })

    it('Fails if is not called by the receiver of the transaction', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeByReceiver(transactionId, {
        value: newArbitrationCost,
      })
      await expect(tx).to.be.revertedWith('The caller must be the receiver')
    })

    it('Fails if the amount of ETH sent is less than the arbitration cost', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
        value: newArbitrationCost.sub(1),
      })
      await expect(tx).to.be.revertedWith('The receiver fee must be equal to the arbitration cost')
    })

    describe('Successful payment of arbitration fee', async function () {
      let tx: ContractTransaction

      before(async function () {
        tx = await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
          value: newArbitrationCost,
        })
      })

      it('The arbitration fee is sent to the arbitrator', async function () {
        await expect(tx).to.changeEtherBalances(
          [bob.address, talentLayerEscrow.address, talentLayerArbitrator.address],
          [-newArbitrationCost, -arbitrationCostDifference, newArbitrationCost],
        )
      })

      it('First party is reimbursed for overpaying arbitration fee', async function () {
        await expect(tx).to.changeEtherBalances([alice.address], [arbitrationCostDifference])
      })

      it('The fee amount paid by the receiver is stored in the transaction', async function () {
        const transaction = await talentLayerEscrow
          .connect(bob)
          .getTransactionDetails(transactionId)
        expect(transaction.receiverFee).to.be.eq(newArbitrationCost)
      })

      it('The transaction status becomes "DisputeCreated"', async function () {
        const transaction = await talentLayerEscrow
          .connect(bob)
          .getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.DisputeCreated)
      })

      it('A dispute is created, with the correct data', async function () {
        const dispute = await talentLayerArbitrator.disputes(disputeId)
        expect(dispute.arbitrated).to.be.eq(talentLayerEscrow.address)
        expect(dispute.fee).to.be.eq(newArbitrationCost)
        expect(dispute.platformId).to.be.eq(carolPlatformId)

        const status = await talentLayerArbitrator.disputeStatus(disputeId)
        const ruling = await talentLayerArbitrator.currentRuling(disputeId)
        expect(status).to.be.eq(DisputeStatus.Waiting)
        expect(ruling).to.be.eq(0)
      })
    })
  })

  describe('Attempt to release/reimburse after a dispute', async function () {
    it('Release fails since ther must be no dispute to release', async function () {
      const tx = talentLayerEscrow
        .connect(alice)
        .release(aliceTlId, transactionId, transactionReleasedAmount)
      await expect(tx).to.be.revertedWith("The transaction shouldn't be disputed")
    })

    it('Reimbursement fails since there must be no dispute to reimburse', async function () {
      const tx = talentLayerEscrow
        .connect(bob)
        .reimburse(bobTlId, transactionId, transactionReimbursedAmount)
      await expect(tx).to.be.revertedWith("The transaction shouldn't be disputed")
    })
  })

  describe('Submission of Evidence', async function () {
    it('Fails if the transaction does not have an arbitrator set', async function () {
      const tx = talentLayerEscrow.connect(alice).submitEvidence(aliceTlId, 0, evidenceCid)
      await expect(tx).to.be.revertedWith('Arbitrator not set')
    })

    it('Fails if the cid is invalid', async function () {
      const tx = talentLayerEscrow.connect(alice).submitEvidence(aliceTlId, transactionId, '')
      await expect(tx).to.be.revertedWith('Invalid cid')
    })

    it('Fails if evidence is not submitted by either sender or receiver of the transaction', async function () {
      const tx = talentLayerEscrow
        .connect(dave)
        .submitEvidence(daveTlId, transactionId, evidenceCid)
      await expect(tx).to.be.revertedWith(
        'The caller must be the sender or the receiver or their delegates',
      )
    })

    it('The evidence event is emitted when the sender submits it', async function () {
      const tx = await talentLayerEscrow
        .connect(alice)
        .submitEvidence(aliceTlId, transactionId, evidenceCid)
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Evidence')
        .withArgs(talentLayerArbitrator.address, transactionId, alice.address, evidenceCid)
    })

    it('The evidence event is emitted when the receiver submits it', async function () {
      const tx = await talentLayerEscrow
        .connect(bob)
        .submitEvidence(bobTlId, transactionId, evidenceCid)
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Evidence')
        .withArgs(talentLayerArbitrator.address, transactionId, bob.address, evidenceCid)
    })
  })

  describe('Submission of a ruling', async function () {
    it('Fails if ruling is not given by the arbitrator contract', async function () {
      const tx = talentLayerEscrow.connect(dave).rule(disputeId, rulingId)
      await expect(tx).to.be.revertedWith('The caller must be the arbitrator')
    })

    it('Fails if ruling is not given by the platform owner', async function () {
      const tx = talentLayerArbitrator.connect(dave).giveRuling(disputeId, rulingId)
      await expect(tx).to.be.revertedWith("You're not the owner of the platform")
    })

    it('Fails if ruling id is invalid', async function () {
      const tx = talentLayerArbitrator.connect(carol).giveRuling(disputeId, 4)
      await expect(tx).to.be.revertedWith('Invalid ruling.')
    })

    describe('Successful submission of a ruling', async function () {
      let tx: ContractTransaction

      before(async function () {
        // Rule in favor of the sender (Alice)
        tx = await talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)
      })

      it('The winner of the dispute (Alice) receives escrow funds and gets arbitration fee reimbursed', async function () {
        // Calculate total sent amount, including fees and arbitration cost reimbursement
        const totalAmountSent = currentTransactionAmount
          .add(
            currentTransactionAmount
              .mul(protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)
              .div(feeDivider),
          )
          .add(newArbitrationCost)

        await expect(tx).to.changeEtherBalances(
          [alice.address, talentLayerEscrow.address],
          [totalAmountSent, -totalAmountSent],
        )
      })

      it('The owner of the platform (Carol) receives the arbitration fee', async function () {
        await expect(tx).to.changeEtherBalances(
          [carol.address, talentLayerArbitrator.address],
          [newArbitrationCost, -newArbitrationCost],
        )
      })

      it('The status of the transaction becomes "Resolved"', async function () {
        const transaction = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId)
        expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
      })

      it('Dispute data is updated', async function () {
        const status = await talentLayerArbitrator.disputeStatus(disputeId)
        const ruling = await talentLayerArbitrator.currentRuling(disputeId)
        expect(status).to.be.eq(DisputeStatus.Solved)
        expect(ruling).to.be.eq(rulingId)
      })

      it('Sets the service as uncompleted', async function () {
        const service = await talentLayerService.getService(serviceId)
        expect(service.status).to.be.eq(ServiceStatus.Uncompleted)
      })

      it('Emits the Payment event', async function () {
        await expect(tx)
          .to.emit(talentLayerEscrow, 'Payment')
          .withArgs(
            transactionId,
            PaymentType.Reimburse,
            ethers.constants.AddressZero,
            currentTransactionAmount,
            serviceId,
          )
      })

      it('Submission of ruling fails if the dispute is already solved', async function () {
        const tx = talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)
        await expect(tx).to.be.revertedWith('The dispute must not be solved already.')
      })
    })
  })

  describe('Appealing a ruling', async function () {
    it('Fails if the transaction does not have an arbitrator set', async function () {
      const tx = talentLayerEscrow.connect(alice).appeal(0)
      await expect(tx).to.be.revertedWith('Arbitrator not set')
    })

    it('Fails because cost is too high', async function () {
      const tx = talentLayerEscrow.connect(bob).appeal(transactionId, {
        value: ethers.utils.parseEther('100'),
      })
      await expect(tx).to.be.revertedWith('Not enough ETH to cover appeal costs.')
    })
  })

  describe("Can't do actions on a resolved dispute", async function () {
    it('Fails to pay arbitration fee by sender on resolved dispute', async function () {
      const tx = talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith(
        'Dispute has already been created or because the transaction has been executed',
      )
    })

    it('Fails to pay arbitration fee by receiver on resolved dispute', async function () {
      const tx = talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
        value: arbitrationCost,
      })
      await expect(tx).to.be.revertedWith(
        'Dispute has already been created or because the transaction has been executed',
      )
    })

    it('Fails to submit evidence on resolved dispute', async function () {
      const tx = talentLayerEscrow
        .connect(alice)
        .submitEvidence(aliceTlId, transactionId, evidenceCid)
      await expect(tx).to.be.revertedWith('Must not send evidence if the dispute is resolved')
    })
  })
})

describe('Dispute Resolution, with sender failing to pay arbitration fee on time', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerService: TalentLayerService,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator

  const newArbitrationCost = arbitrationCost.add(2)

  before(async function () {
    ;[, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, ethers.constants.AddressZero)

    // Create transaction
    await createTransaction(
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerService,
      alice,
      ethAddress,
    )

    // Alice wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: arbitrationCost,
    })

    // Carol increases arbitration fee on arbitrator
    await talentLayerArbitrator
      .connect(carol)
      .setArbitrationPrice(carolPlatformId, newArbitrationCost)

    // Bob pays the cost of the new arbitration fee
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: newArbitrationCost,
    })

    // Simulate arbitration fee timeout expiration
    await time.increase(arbitrationFeeTimeout)
  })

  describe('One party (in our case receiver) fails to pay arbitration fee on time', function () {
    let tx: ContractTransaction

    before(async function () {
      tx = await talentLayerEscrow.connect(bob).arbitrationFeeTimeout(transactionId)
      // we check the transaction status
      const transaction = await talentLayerEscrow.connect(bob).getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
    })

    it('The receiver (Bob) wins the dispute, receives escrow funds and parties get paid arbitration fee reimbursed', async function () {
      const sentAmount = transactionAmount.add(newArbitrationCost)

      await expect(tx).to.changeEtherBalances(
        [alice.address, bob.address, talentLayerEscrow.address],
        [arbitrationCost, sentAmount, -sentAmount.add(arbitrationCost)],
      )
    })

    it('The status of the transaction becomes "Resolved"', async function () {
      const transaction = await talentLayerEscrow
        .connect(alice)
        .getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
    })
  })
})

describe('Dispute Resolution, with receiver failing to pay arbitration fee on time', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerService: TalentLayerService,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    totalTransactionAmount: BigNumber

  const newArbitrationCost = arbitrationCost.add(2)

  before(async function () {
    ;[, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, ethers.constants.AddressZero)

    // Create transaction
    ;[, totalTransactionAmount] = await createTransaction(
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerService,
      alice,
      ethAddress,
    )

    // Bob wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: arbitrationCost,
    })

    // Carol increases arbitration fee on arbitrator
    await talentLayerArbitrator
      .connect(carol)
      .setArbitrationPrice(carolPlatformId, newArbitrationCost)

    // Alice pays the cost of the new arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: newArbitrationCost,
    })

    // Simulate arbitration fee timeout expiration
    await time.increase(arbitrationFeeTimeout)
  })

  describe('One party (in our case receiver) fails to pay arbitration fee on time', function () {
    let tx: ContractTransaction

    before(async function () {
      tx = await talentLayerEscrow.connect(alice).arbitrationFeeTimeout(transactionId)
      // we check the transaction status
      const transaction = await talentLayerEscrow
        .connect(alice)
        .getTransactionDetails(transactionId)
      expect(transaction.status).to.be.eq(TransactionStatus.Resolved)
    })

    it('The sender (Alice) wins the dispute, receives escrow funds and parties get paid arbitration fee reimbursed', async function () {
      const sentAmount = totalTransactionAmount.add(newArbitrationCost)

      await expect(tx).to.changeEtherBalances(
        [alice.address, bob.address, talentLayerEscrow.address],
        [sentAmount, arbitrationCost, -sentAmount.add(arbitrationCost)],
      )
    })
  })
})

describe('Dispute Resolution, arbitrator abstaining from giving a ruling', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerService: TalentLayerService,
    protocolEscrowFeeRate: number,
    originServiceFeeRate: number,
    originValidatedProposalFeeRate: number

  before(async function () {
    ;[deployer, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, ethers.constants.AddressZero)

    // Create transaction
    ;[, , protocolEscrowFeeRate, originServiceFeeRate, originValidatedProposalFeeRate] =
      await createTransaction(
        talentLayerPlatformID,
        talentLayerEscrow,
        talentLayerService,
        alice,
        ethAddress,
      )

    // Alice wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: arbitrationCost,
    })

    // Bob pays the arbitration fee and a dispute is created
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: arbitrationCost,
    })
  })

  describe('The arbitrator abstains from giving a ruling', async function () {
    let tx: ContractTransaction,
      halfTransactionAmount: BigNumber,
      halfArbitrationCost: BigNumber,
      halfAmount: BigNumber

    before(async function () {
      tx = await talentLayerArbitrator.connect(carol).giveRuling(0, 0)
      halfTransactionAmount = transactionAmount.div(2)
      halfArbitrationCost = arbitrationCost.div(2)
      halfAmount = halfTransactionAmount.add(halfArbitrationCost)
    })

    it('Split funds and arbitration fee half and half between the parties', async function () {
      // Transaction fees reimbursed to sender
      const fees = halfTransactionAmount
        .mul(protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)
        .div(feeDivider)

      const senderAmount = halfAmount.add(fees)
      const totalSentAmount = transactionAmount.add(arbitrationCost).add(fees)

      await expect(tx).to.changeEtherBalances(
        [alice.address, bob.address, talentLayerEscrow.address],
        [senderAmount, halfAmount, -totalSentAmount],
      )
    })

    it('Increases platform token balance by the platform fee', async function () {
      const carolPlatformBalance = await talentLayerEscrow
        .connect(carol)
        .getClaimableFeeBalance(ethers.constants.AddressZero)
      const platformEscrowFeeRatesPaid = halfTransactionAmount
        .mul(originValidatedProposalFeeRate + originServiceFeeRate)
        .div(feeDivider)
      expect(carolPlatformBalance).to.be.eq(platformEscrowFeeRatesPaid)
    })

    it('Increases protocol token balance by the protocol fee', async function () {
      const protocolBalance = await talentLayerEscrow
        .connect(deployer)
        .getClaimableFeeBalance(ethers.constants.AddressZero)
      const protocolEscrowFeeRatesPaid = halfTransactionAmount
        .mul(protocolEscrowFeeRate)
        .div(feeDivider)
      expect(protocolBalance).to.be.eq(protocolEscrowFeeRatesPaid)
    })

    it('Emits the Payment events', async function () {
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Payment')
        .withArgs(
          transactionId,
          PaymentType.Release,
          ethers.constants.AddressZero,
          halfTransactionAmount,
          serviceId,
        )

      await expect(tx)
        .to.emit(talentLayerEscrow, 'Payment')
        .withArgs(
          transactionId,
          PaymentType.Reimburse,
          ethers.constants.AddressZero,
          halfTransactionAmount,
          serviceId,
        )
    })
  })
})

describe('Dispute Resolution, receiver winning', function () {
  let alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerService: TalentLayerService,
    tx: ContractTransaction

  const newArbitrationCost = BigNumber.from(8)
  const arbitrationCostDifference = arbitrationCost.sub(newArbitrationCost)

  before(async function () {
    ;[, alice, bob, carol] = await ethers.getSigners()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, ethers.constants.AddressZero)

    // Create transaction
    await createTransaction(
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerService,
      alice,
      ethAddress,
    )

    // Bob wants to raise a dispute and pays the arbitration fee and a dispute is created
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: arbitrationCost,
    })

    // Carol decreases arbitration fee on arbitrator
    await talentLayerArbitrator
      .connect(carol)
      .setArbitrationPrice(carolPlatformId, newArbitrationCost)

    // Alice pays the arbitration fee and the dispute is created
    tx = await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: newArbitrationCost,
    })
  })

  it('Receiver is reimbursed for overpaying arbitration fee', async function () {
    await expect(tx).to.changeEtherBalances(
      [bob.address, talentLayerEscrow.address],
      [arbitrationCostDifference, -arbitrationCostDifference],
    )
  })

  describe('Submission of a ruling', async function () {
    let tx: ContractTransaction
    const rulingId = 2

    before(async function () {
      // Rule in favor of the sender (Alice)
      tx = await talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)
    })

    it('The winner of the dispute (Bob) receives escrow funds and gets arbitration fee reimbursed', async function () {
      // Calculate total sent amount, including fees and arbitration cost reimbursement
      const totalAmountSent = transactionAmount.add(newArbitrationCost)

      await expect(tx).to.changeEtherBalances(
        [bob.address, talentLayerEscrow.address],
        [totalAmountSent, -totalAmountSent],
      )
    })

    it('The owner of the platform (Carol) receives the arbitration fee', async function () {
      await expect(tx).to.changeEtherBalances(
        [carol.address, talentLayerArbitrator.address],
        [newArbitrationCost, -newArbitrationCost],
      )
    })

    it('Sets the service as uncompleted', async function () {
      const service = await talentLayerService.getService(serviceId)
      expect(service.status).to.be.eq(ServiceStatus.Uncompleted)
    })

    it('Emits the Payment event', async function () {
      await expect(tx)
        .to.emit(talentLayerEscrow, 'Payment')
        .withArgs(
          transactionId,
          PaymentType.Release,
          ethers.constants.AddressZero,
          transactionAmount,
          serviceId,
        )
    })
  })
})

describe('Dispute Resolution, with ERC20 token transaction', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    simpleERC20: SimpleERC20,
    talentLayerService: TalentLayerService,
    totalTransactionAmount: BigNumber

  const rulingId = 1

  before(async function () {
    ;[deployer, alice, bob, carol] = await ethers.getSigners()

    // Deploy SimpleERC20 token and setup
    const SimpleERC20 = await ethers.getContractFactory('SimpleERC20')
    simpleERC20 = await SimpleERC20.deploy()
    ;[talentLayerPlatformID, talentLayerEscrow, talentLayerArbitrator, talentLayerService] =
      await deployAndSetup(arbitrationFeeTimeout, simpleERC20.address)

    if (!(await talentLayerService.isTokenAllowed(simpleERC20.address))) {
      await talentLayerService
        .connect(deployer)
        .updateAllowedTokenList(simpleERC20.address, true, minTokenWhitelistTransactionAmount)
    }

    ;[totalTransactionAmount] = await getTransactionDetails(
      talentLayerPlatformID,
      talentLayerEscrow,
    )

    // Transfer tokens to Alice
    await simpleERC20.transfer(alice.address, totalTransactionAmount)

    // Allow TalentLayerEscrow to transfer tokens on behalf of Alice
    await simpleERC20.connect(alice).approve(talentLayerEscrow.address, totalTransactionAmount)

    // Create transaction
    await createTransaction(
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerService,
      alice,
      simpleERC20.address,
    )

    // Alice wants to raise a dispute and pays the arbitration fee
    await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
      value: arbitrationCost,
    })

    // Bob pays the arbitration fee and a dispute is created
    await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
      value: arbitrationCost,
    })
  })

  describe('Submission of a ruling', async function () {
    let tx: ContractTransaction

    before(async function () {
      // Rule in favor of the sender (Alice)
      tx = await talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)
    })

    it('The winner of the dispute (Alice) receives escrow funds and gets arbitration fee reimbursed', async function () {
      await expect(tx).to.changeTokenBalances(
        simpleERC20,
        [alice.address, talentLayerEscrow.address],
        [totalTransactionAmount, -totalTransactionAmount],
      )
      await expect(tx).to.changeEtherBalances(
        [alice.address, talentLayerEscrow.address],
        [arbitrationCost, -arbitrationCost],
      )
    })
  })
})
