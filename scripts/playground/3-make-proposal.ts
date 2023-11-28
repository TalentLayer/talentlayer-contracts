import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import postToIPFS from '../utils/ipfs'
import { getSignatureForProposal } from '../../test/utils/signature'

const aliceTlId = 1
const bobTlId = 2
const carolTlId = 3
const daveTlId = 4

const minTokenWhitelistTransactionAmount = ethers.utils.parseUnits('0.0001', 18)

/*
In this script Bob, Carol and Dave will create proposals for Alice's services
Bob and Carol for the first service (with ETH and Token) and Dave for the second service (Token)
*/

import hre = require('hardhat')
import { proposalExpirationDate } from './constants'

// Then Alice create a service, and others add proposals
async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const talentLayerService = await ethers.getContractAt(
    'TalentLayerService',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerService),
  )
  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const davePlatformId = await platformIdContract.ids(dave.address)
  const bobPlatformId = await platformIdContract.ids(bob.address)

  const simpleERC20 = await ethers.getContractAt(
    'SimpleERC20',
    getDeploymentProperty(network, DeploymentProperty.SimpleERC20),
  )
  await talentLayerService
    .connect(alice)
    .updateAllowedTokenList(ethers.constants.AddressZero, true, minTokenWhitelistTransactionAmount)
  await talentLayerService
    .connect(alice)
    .updateAllowedTokenList(simpleERC20.address, true, minTokenWhitelistTransactionAmount)

  // Get the first and second service id
  const nextServiceId = await talentLayerService.nextServiceId()
  const firstServiceId = nextServiceId.sub(2)
  const secondServiceId = nextServiceId.sub(1)
  console.log('firstServiceId', firstServiceId.toString())
  console.log('secondServiceId', secondServiceId.toString())

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

  // Bob creates a proposal #2 for Alice's service #1 on Dave's platform #1 (id : 1-2 in GraphQL)

  const signatureBobProposal = await getSignatureForProposal(dave, bobTlId, 1, bobUri)

  const rateTokenBob = simpleERC20.address
  const bobProposal = await talentLayerService
    .connect(bob)
    .createProposal(
      bobTlId,
      firstServiceId,
      rateTokenBob,
      ethers.utils.parseUnits('0.001', 18),
      davePlatformId,
      bobUri,
      proposalExpirationDate,
      signatureBobProposal,
    )
  console.log('Bob proposal created')
  await bobProposal.wait()
  // get the proposal
  const bobProposalData = await talentLayerService.proposals(firstServiceId, 2)
  console.log('Bob proposal', bobProposalData)

  // Carol make a proposal #3 for Alice's service #1 on Bob's platform #2 (id : 1-3 in GraphQL)

  const signatureCarolProposal = await getSignatureForProposal(bob, carolTlId, 1, carolUri)

  const rateTokenCarol = '0x0000000000000000000000000000000000000000'
  const carolProposal = await talentLayerService
    .connect(carol)
    .createProposal(
      carolTlId,
      firstServiceId,
      rateTokenCarol,
      ethers.utils.parseUnits('0.002', 18),
      bobPlatformId,
      carolUri,
      proposalExpirationDate,
      signatureCarolProposal,
    )
  console.log('Carol proposal created')
  await carolProposal.wait()
  // get the proposal
  const carolProposalData = await talentLayerService.proposals(firstServiceId, 3)
  console.log('Carol proposal', carolProposalData)

  // Dave create a proposal #4 for Alice's service #2 on Bob's platform #2 (id : 2-4 in GraphQL)

  const signatureDaveProposal = await getSignatureForProposal(bob, daveTlId, 2, daveUri)

  const rateTokenDave = simpleERC20.address
  const daveProposal = await talentLayerService
    .connect(dave)
    .createProposal(
      daveTlId,
      secondServiceId,
      rateTokenDave,
      ethers.utils.parseUnits('0.003', 18),
      bobPlatformId,
      daveUri,
      proposalExpirationDate,
      signatureDaveProposal,
    )
  console.log('Dave proposal created')
  await daveProposal.wait()
  // get the proposal
  const daveProposalData = await talentLayerService.proposals(secondServiceId, 4)
  console.log('Dave proposal', daveProposalData)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
