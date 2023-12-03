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

  const [alice, , carol] = await ethers.getSigners()

  const talentLayerReview = await ethers.getContractAt(
    'TalentLayerReview',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerReview),
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

  await talentLayerReview.connect(alice).mint(aliceTlId, 1, aliceReviewCarol, 5)
  console.log('Alice reviewed Carol')
  await talentLayerReview.connect(carol).mint(carolTlId, 1, carolReviewAlice, 3)
  console.log('Carol reviewed Alice')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
