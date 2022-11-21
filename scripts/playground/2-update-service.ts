import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')
import postToIPFS from '../ipfs'

async function main() {
  const network = await hre.network.name
  console.log('Create service Test start---------------------')
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )
  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  console.log('Dave Talent Layer Id', daveTalentLayerIdPLatform)

  /* ----------- Alice Update her Service -------------- */

  const aliceUpdateJobData = await postToIPFS(
    JSON.stringify({
      title: 'Update title',
      about: 'Update about',
      keywords: 'Update Keyword',
      role: 'developer',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )
  console.log('Alice Job Updated data Uri', aliceUpdateJobData)

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)
  console.log('the Alice service id is ', serviceId.toString())

  await serviceRegistry.connect(alice).updateServiceData(serviceId, aliceUpdateJobData)
  const jobDataAfterUpdate = await serviceRegistry.getService(serviceId)
  console.log('Job Data after update', jobDataAfterUpdate)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
