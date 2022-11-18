import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')
import postToIPFS from '../ipfs'

async function main() {
  const network = await hre.network.name
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

  console.log('Open Service created------------------------')

  const aliceCreateJobData = await postToIPFS(
    JSON.stringify({
      title: 'Full Stack Developer Job',
      about: 'Looking for Full Stack Developer',
      keywords: 'BlockChain',
      role: 'developer',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )
  console.log('Alice Job Data Uri', aliceCreateJobData)

  const aliceSecondCreateJobData = await postToIPFS(
    JSON.stringify({
      title: 'Tester Job',
      about: 'Looking for Tester',
      keywords: 'BlockChain',
      role: ' tester',
      rateToken: '0x0000000000000000000000000000000000000000',
      rateAmount: 1,
      recipient: '',
    }),
  )

  console.log('Alice Second Job Data Uri', aliceSecondCreateJobData)

  const createOpenService = await serviceRegistry
    .connect(alice)
    .createOpenServiceFromBuyer(daveTalentLayerIdPLatform, aliceCreateJobData)
  await createOpenService.wait()
  console.log('Alice Create Open Service', createOpenService)

  const createSecondOpenService = await serviceRegistry
    .connect(alice)
    .createOpenServiceFromBuyer(daveTalentLayerIdPLatform, aliceSecondCreateJobData)
  await createOpenService.wait()
  console.log('Alice Create Second Open Service', createSecondOpenService)

  console.log('Alice updated the Job data------------------------')

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

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(2)
  console.log('Alice updated the service with the id n° ', serviceId.toString())

  await serviceRegistry.connect(alice).updateServiceData(serviceId, aliceUpdateJobData)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
