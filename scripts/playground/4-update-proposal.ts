import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
import postToIPFS from '../ipfs'
const hre = require('hardhat')

// Then Alice create a service, and others add proposals
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)
  console.log('serviceId', serviceId.toString())

  const rateTokenBob = get(network as Network, ConfigProperty.SimpleERC20)
  const bobUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: 'Javascript Developer',
      proposalAbout: 'We looking for Javascript Developer',
      rateType: 3,
      expectedHours: 50,
    }),
  )

  await serviceRegistry
    .connect(bob)
    .updateProposal(serviceId, rateTokenBob, ethers.utils.parseUnits('0.0015', 18), bobUri)

  console.log('Bob update his proposal')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
