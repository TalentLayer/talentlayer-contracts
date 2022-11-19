import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

async function main() {
  const network = await hre.network.name
  console.log('Create service Test start---------------------')
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)

  // Getting all created services
  console.log('Get All created services---------------------')

  const getAllCreatedServices = await serviceRegistry.getAllServices()
  console.log('All Services', getAllCreatedServices)

  // getting all Services created by a specific user
  console.log('Get All created services by a specific user---------------------')

  const getAllServicesForUser = await serviceRegistry.getAllServicesForUser(1)
  console.log('Services by user', getAllServicesForUser)

  // Getting all proposals created for a service
  console.log('Get All created proposals for a service ---------------------')

  const getAllProposalsForService = await serviceRegistry.getAllProposalsForService(serviceId)
  console.log('All Proposals for a service', getAllProposalsForService)

  // getting all proposals created by a specific user
  console.log('Get All created proposals by a specific user---------------------')
  const getAllProposalsForUser = await serviceRegistry.getAllProposalsForUser(2)
  console.log('Services by user', getAllProposalsForUser)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
