import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'
import hre = require('hardhat')

/*
in this script we will mint a new platform ID for HireVibes
We first need to grant the MINT_ROLE to the address (Dave) who will mint the new Platform ID
After that we mint the new Platform ID Dave will update the profile data.
*/

async function main() {
  const network = await hre.network.name
  console.log(network)
  console.log('Mint HireVibes platform ID start')

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerPlatformID),
  )

  const mintRole = await platformIdContrat.MINT_ROLE()
  //Deployer needs MINT_ROLE to mint for other addresses
  const grantRole = await platformIdContrat.connect(alice).grantRole(mintRole, alice.address)
  await grantRole.wait()
  const mint = await platformIdContrat.connect(alice).mintForAddress('HireVibes', dave.address)
  await mint.wait()

  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  await platformIdContrat.connect(dave).updateProfileData(daveTalentLayerIdPLatform, 'newCid')

  const davePlatformData = await platformIdContrat.platforms(daveTalentLayerIdPLatform)

  const platformName = davePlatformData.name
  const platformCid = davePlatformData.dataUri

  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPLatform)
  console.log('platformName', platformName)
  console.log('platformCid', platformCid)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
