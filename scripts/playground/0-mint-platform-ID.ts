import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

/*
in this script we will mint a new platform ID for HireVibes
We first need to grant the MINT_ROLE to the address (Dave) who will mint the new Platform ID
After that we mint the new Platform ID Dave will update the profile data.
*/

async function main() {
  const network = hre.network.name
  console.log(network)
  console.log('Mint Dave platform ID start')

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const platformIdContract = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const mintRole = await platformIdContract.MINT_ROLE()
  //Deployer needs MINT_ROLE to mint for other addresses
  const grantRole = await platformIdContract.connect(alice).grantRole(mintRole, alice.address)
  await grantRole.wait()
  const mint = await platformIdContract.connect(alice).mintForAddress('Playground', dave.address)
  await mint.wait()

  const daveTalentLayerIdPlatform = await platformIdContract.getPlatformIdFromAddress(dave.address)
  await platformIdContract.connect(dave).updateProfileData(daveTalentLayerIdPlatform, 'newCid')

  const davePlatformData = await platformIdContract.platforms(daveTalentLayerIdPlatform)

  const platformName = davePlatformData.name
  const platformCid = davePlatformData.dataUri

  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPlatform)
  console.log('platformName', platformName)
  console.log('platformCid', platformCid)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
