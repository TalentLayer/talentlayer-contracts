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

  const simpleERC20 = await ethers.getContractAt('SimpleERC20', get(network as Network, ConfigProperty.SimpleERC20))

  let serviceId = await serviceRegistry.nextServiceId()
  serviceId = serviceId.sub(1)
  console.log('serviceId', serviceId.toString())

  /* ---------  IPFS for proposal --------- */

  //Bob proposals data
  const bobUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: 'Bob : Javascript Developer',
      proposalAbout: 'We looking for Javascript Developer',
      rateType: 3,
      expectedHours: 50,
    }),
  )
  console.log('Bob proposal uri ===> ', bobUri)

  //Carol proposals data
  const carolUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: 'Carol : C++ developer',
      proposalAbout: 'We are looking for a C++ developer',
      rateType: 4,
      expectedHours: 20,
    }),
  )
  console.log('Carol proposal Uri =====> ', carolUri)

  //Dave proposals data
  const daveUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: 'Dave :  developer',
      proposalAbout: 'We are looking for a Ninja developer',
      rateType: 3,
      expectedHours: 10,
    }),
  )
  console.log('Dave proposal Uri =====> ', daveUri)

  /* ---------  Proposal creation --------- */

  // Bob create a proposal
  const rateTokenBob = simpleERC20.address
  await serviceRegistry
    .connect(bob)
    .createProposal(serviceId, rateTokenBob, ethers.utils.parseUnits('0.001', 18), bobUri)
  console.log('Bob proposal created')

  // Carol make a proposal
  const rateTokenCarol = '0x0000000000000000000000000000000000000000'
  await serviceRegistry
    .connect(carol)
    .createProposal(serviceId, rateTokenCarol, ethers.utils.parseUnits('0.002', 18), carolUri)
  console.log('Carol proposal created')

  // Dave create a proposal
  const rateTokenDave = simpleERC20.address
  await serviceRegistry
    .connect(dave)
    .createProposal(serviceId, rateTokenDave, ethers.utils.parseUnits('0.003', 18), daveUri)
  console.log('Dave proposal created')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
