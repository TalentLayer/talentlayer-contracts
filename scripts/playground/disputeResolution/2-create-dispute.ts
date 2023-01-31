import { ethers } from 'hardhat'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../utils/config'
import { arbitrationCost, transactionId } from './constants'

const hre = require('hardhat')

/**
 * In this script, Bob (the seller) pays the arbitration fee  as well (which has already been paid by the sender)
 * and a dispute is created.
 */
async function main() {
  const network = await hre.network.name
  console.log('Network: ', network)

  const [, , bob] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    get(network as Network, ConfigProperty.TalentLayerEscrow),
  )

  // Bob pays the arbitration fee and a dispute is created
  await talentLayerEscrow.connect(bob).payArbitrationFeeByReceiver(transactionId, {
    value: arbitrationCost,
  })

  console.log('Arbitration fee paid by Bob and dispute created')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
