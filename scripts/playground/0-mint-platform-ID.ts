import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

async function main() {
  const network = await hre.network.name
  console.log(network)
  console.log('Mint HireVibes platform ID start')

  const [alice, bob, carol, dave] = await ethers.getSigners()

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  const mintRole = await platformIdContrat.MINT_ROLE()
  await platformIdContrat.connect(alice).grantRole(mintRole, dave.address)
  await platformIdContrat.connect(dave).mint('HireVibes')

  const daveTalentLayerIdPLatform = await platformIdContrat.getPlatformIdFromAddress(dave.address)
  console.log('Alice talentLayerIdPLatform', daveTalentLayerIdPLatform)

  await platformIdContrat.connect(dave).updateProfileData(daveTalentLayerIdPLatform, 'newCid')

  const davePlatformData = await platformIdContrat.platforms(daveTalentLayerIdPLatform)

  const platformName = davePlatformData.name
  const platformCid = davePlatformData.dataUri

  console.log('platformName', platformName)
  console.log('platformCid', platformCid)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
