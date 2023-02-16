import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

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

  // Dave is a TalentLayer Platform and a TalentLayer User
  const daveTalentLayerIdPlatform = await platformIdContract.ids(dave.address)
  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPlatform)

  await talentLayerIdContract.connect(alice).mint(daveTalentLayerIdPlatform, 'alice')
  console.log('alice registered')

  await talentLayerIdContract.connect(bob).mint(daveTalentLayerIdPlatform, 'bob')
  console.log('Bob registered')

  await talentLayerIdContract.connect(carol).mint(daveTalentLayerIdPlatform, 'carol')
  console.log('carol registered')

  await talentLayerIdContract.connect(dave).mint(daveTalentLayerIdPlatform, 'dave')
  console.log('dave registered')
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
