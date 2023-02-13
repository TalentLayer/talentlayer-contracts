import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import postToIPFS from '../utils/ipfs'
import hre = require('hardhat')

const aliceTlId = 1
const carolTlId = 3

/*
In this scriptAlice will review Carol and Carol will review Alice
*/

async function main() {
  const network = hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerReview = await ethers.getContractAt(
    'TalentLayerReview',
    getDeploymentProperty(network, DeploymentProperty.Reviewscontract),
  )

  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const aliceReviewCarol = await postToIPFS(
    JSON.stringify({
      content: 'Alice review Carol',
      rating: 4,
    }),
  )
  console.log('aliceReviewCarolIpfsUri', aliceReviewCarol)

  const carolReviewAlice = await postToIPFS(
    JSON.stringify({
      content: 'Carol review Alice',
      rating: 3,
    }),
  )
  console.log('carolReviewAliceIpfsUri', carolReviewAlice)

  const daveTalentLayerIdPlatform = await platformIdContract.getPlatformIdFromAddress(dave.address)
  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPlatform)

  await talentLayerReview
    .connect(alice)
    .addReview(aliceTlId, 1, aliceReviewCarol, 5, daveTalentLayerIdPlatform)
  console.log('Alice reviewed Carol')
  await talentLayerReview
    .connect(carol)
    .addReview(carolTlId, 1, carolReviewAlice, 3, daveTalentLayerIdPlatform)
  console.log('Carol reviewed Alice')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
