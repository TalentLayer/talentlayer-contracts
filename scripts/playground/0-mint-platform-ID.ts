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
  
  const mint1 = await platformIdContract.connect(alice).mintForAddress('Playground', dave.address)
  await mint1.wait()
  const mint2 = await platformIdContract.connect(alice).mintForAddress('Playground2', bob.address)
  await mint2.wait()

  const daveTalentLayerIdPlatform = await platformIdContract.getPlatformIdFromAddress(dave.address)
  await platformIdContract.connect(dave).updateProfileData(daveTalentLayerIdPlatform, 'newCid')
  await platformIdContract.connect(dave).updateOriginServiceFeeRate(daveTalentLayerIdPlatform, 1000)
  await platformIdContract
    .connect(dave)
    .updateOriginValidatedProposalFeeRate(daveTalentLayerIdPlatform, 2500)

  const bobTalentLayerIdPlatform = await platformIdContract.getPlatformIdFromAddress(bob.address)
  await platformIdContract.connect(bob).updateProfileData(bobTalentLayerIdPlatform, 'newCid')
  await platformIdContract.connect(bob).updateOriginServiceFeeRate(bobTalentLayerIdPlatform, 1500)
  await platformIdContract
    .connect(bob)
    .updateOriginValidatedProposalFeeRate(bobTalentLayerIdPlatform, 3500)

  const davePlatformData = await platformIdContract.platforms(daveTalentLayerIdPlatform)
  const bobPlatformData = await platformIdContract.platforms(bobTalentLayerIdPlatform)

  console.log('Dave talentLayerIdPlatform', daveTalentLayerIdPlatform)
  console.log('Dave platformName', davePlatformData.name)
  console.log('Dave platformCid', davePlatformData.dataUri)
  console.log('Dave origin service fee rate', davePlatformData.originServiceFeeRate)
  console.log(
    'Dave origin validated proposal fee rate',
    davePlatformData.originValidatedProposalFeeRate,
  )

  console.log('Bob talentLayerIdPlatform', bobTalentLayerIdPlatform)
  console.log('Bob platformName', bobPlatformData.name)
  console.log('Bob platformCid', bobPlatformData.dataUri)
  console.log('Bob origin service fee rate', bobPlatformData.originServiceFeeRate)
  console.log(
    'Bob origin validated proposal fee rate',
    bobPlatformData.originValidatedProposalFeeRate,
  )
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
