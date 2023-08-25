import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')
import postToIPFS from '../utils/ipfs'

/*
In this script we will mint a new TalentLayer ID for Alice, Bob, Carol and Dave
We need for that to get the TalentLayer Platform ID of Dave then we will mint a new TalentLayer ID
*/

async function main() {
  const network = hre.network.name
  console.log(network)
  console.log('Mint test ID start')

  const [alice, bob, carol, dave] = await ethers.getSigners()
  console.log({
    alice: alice.address,
    bob: bob.address,
    carol: carol.address,
    dave: dave.address,
  })

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerID),
  )

  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  // Active public mint
  await talentLayerIdContract.updateMintStatus(2)

  // Dave is a TalentLayer Platform and a TalentLayer User
  const daveTalentLayerIdPlatform = await platformIdContract.ids(dave.address)
  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPlatform)

  await talentLayerIdContract.connect(alice).mint(daveTalentLayerIdPlatform, 'alice')
  console.log('alice registered')
  // we get the nft uri and check the display
  const aliceTalentLayerId = await talentLayerIdContract.ids(alice.address)
  const nftAliceURi = await talentLayerIdContract.tokenURI(aliceTalentLayerId)
  console.log('nftAliceURi', nftAliceURi)

  await talentLayerIdContract.connect(bob).mint(daveTalentLayerIdPlatform, 'bob__')
  console.log('Bob registered')

  await talentLayerIdContract.connect(carol).mint(daveTalentLayerIdPlatform, 'carol')
  console.log('carol registered')

  await talentLayerIdContract.connect(dave).mint(daveTalentLayerIdPlatform, 'dave_')
  console.log('dave registered')

  // Alice update her profile data
  const aliceProfileData = await postToIPFS(
    JSON.stringify({
      name: 'Alice',
      title: 'Full Stack Developer',
      web3mailPreferences: {
        activeOnNewService: true,
        activeOnProtocolMarketing: false,
      },
    }),
  )
  console.log('Alice Profile Data Uri', aliceProfileData)
  await talentLayerIdContract.connect(alice).updateProfileData(aliceTalentLayerId, aliceProfileData)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
