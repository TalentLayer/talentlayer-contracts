import hre, { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../.deployment/deploymentManager'

const delegateAddress = '0x26fddc1c2c84e61457734a17c6818a6e063644ec'

const tokenId = 1

async function main() {
  const network = await hre.network.name
  const users = await ethers.getSigners()
  const bob = users[tokenId - 1]

  console.log('Bob address:', bob.address)

  const talentLayerIdContract = await ethers.getContractAt(
    'TalentLayerID',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerID),
  )

  // const isDelegate = await talentLayerIdContract.isDelegate(1, delegateAddress)
  // console.log('isDelegate', isDelegate)

  // const tx = await talentLayerIdContract.connect(bob).addDelegate(tokenId, delegateAddress)
  // await tx.wait()

  const tx = await talentLayerIdContract.connect(bob).removeDelegate(tokenId, delegateAddress)
  await tx.wait()
}

// "delegates": [
//   "0xe821c7795c26bfc7d170b3acedad6ee865b4862e",
//   "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
//   "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
//   "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
// ]

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
