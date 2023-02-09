import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
import { Network } from '../../../config'
import { disputeId, rulingId } from './constants'

import hre = require('hardhat')

/**
 * In this script, Carol (the platform owner) submits the ruling of the dispute.
 * In this case, she chooses to rule in favor of Alice (the buyer), so the funds are released to her.
 */
async function main() {
  const network = await hre.network.name
  console.log('Network: ', network)

  const [, , , carol] = await ethers.getSigners()

  const talentLayerArbitrator = await ethers.getContractAt(
    'TalentLayerArbitrator',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerArbitrator),
  )

  // Carol submits the ruling
  await talentLayerArbitrator.connect(carol).giveRuling(disputeId, rulingId)

  console.log('Ruling submitted by Carol')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
