import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../utils/config'
const hre = require('hardhat')

/*
In this script Alice will reject Bob's proposal
*/

// Then Alice create a service, and others add proposals
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  let nextServiceId = await serviceRegistry.nextServiceId()
  let firstServiceId = nextServiceId.sub(2)
  console.log('serviceId', firstServiceId.toString())

  //Alice rejected Bob proposal
  await serviceRegistry.connect(alice).rejectProposal(firstServiceId, 2)
  console.log('Alice rejected Bob proposal')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
