import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
import { Network } from '../../../networkConfig'
import { arbitrationCost, transactionId } from './constants'

import hre = require('hardhat')

/**
 * In this script, Alice (the buyer) wants to raise a dispute and pays the arbitration fee.
 * She now has to wait for Bob to pay the arbitration fee in order for the dispute to be created.
 */
async function main() {
  const network = await hre.network.name
  console.log('Network: ', network)

  const [, alice] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  // Alice wants to raise a dispute and pays the arbitration fee
  await talentLayerEscrow.connect(alice).payArbitrationFeeBySender(transactionId, {
    value: arbitrationCost,
  })

  console.log('Arbitration fee paid by Alice')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
