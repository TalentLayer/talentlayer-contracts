import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../utils/config'
const hre = require('hardhat')
import postToIPFS from '../utils/ipfs'

/*
In this scriptAlice will review Carol and Carol will review Alice
*/

async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const talentLayerReview = await ethers.getContractAt(
    'TalentLayerReview',
    get(network as Network, ConfigProperty.Reviewscontract),
  )

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
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

  const daveTalentLayerIdPlatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  console.log('Dave talentLayerIdPLatform', daveTalentLayerIdPlatform)

  await talentLayerReview.connect(alice).addReview(1, aliceReviewCarol, 5, daveTalentLayerIdPlatform)
  console.log('Alice reviewed Carol')
  await talentLayerReview.connect(carol).addReview(1, carolReviewAlice, 3, daveTalentLayerIdPlatform)
  console.log('Carol reviewed Alice')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
