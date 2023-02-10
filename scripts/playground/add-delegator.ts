import hre, { ethers } from 'hardhat'
import { ConfigProperty, get } from '../../configManager'
import { Network } from '../utils/config'

const delegateAddress = '0xe821c7795c26bfc7d170b3acedad6ee865b4862e'

async function main() {
  const network = await hre.network.name
  const [, , , carol] = await ethers.getSigners()

  console.log('Bob address:', carol.address)

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    get(network as any as Network, ConfigProperty.TalentLayerID),
  )

  const tx = await talentLayerIdContract.connect(carol).addDelegate(delegateAddress)
  await tx.wait()
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
