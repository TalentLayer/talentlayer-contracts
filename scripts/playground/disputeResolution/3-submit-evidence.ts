import { ethers } from 'hardhat'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../config'
import { transactionId } from './constants'

const hre = require('hardhat')

/**
 * In this script, Alice and Bob submit evidence to support their viewpoints on the dispute.
 */
async function main() {
  const network = await hre.network.name
  console.log('Network: ', network)

  const [, alice, bob] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    get(network as Network, ConfigProperty.TalentLayerEscrow),
  )

  // Alice submits evidence
  const aliceEvidence = "Second alice's evidence"
  await talentLayerEscrow.connect(alice).submitEvidence(transactionId, aliceEvidence)
  console.log("Alice's evidence submitted")

  // Bob submits evidence
  const bobEvidence = "Bob's evidence"
  await talentLayerEscrow.connect(bob).submitEvidence(transactionId, bobEvidence)
  console.log("Bob's evidence submitted")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
