import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
import { arbitrationCost, transactionId } from '../constants'

import hre = require('hardhat')

/**
 * In this script, Bob (the seller) pays the arbitration fee  as well (which has already been paid by the sender)
 * and a dispute is created.
 */
async function main() {
  const network = hre.network.name
  console.log('Network: ', network)

  const [, , bob] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  // Bob pays the arbitration fee and a dispute is created
  await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
    value: arbitrationCost,
  })

  console.log('Arbitration fee paid by Bob and dispute created')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
