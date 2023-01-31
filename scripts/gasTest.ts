import hre, { ethers } from 'hardhat'

import { ConfigProperty, get } from '../configManager'
import { Network } from './utils/config'

async function main() {
  const [deployer, alice, bob, , relayer] = await ethers.getSigners()

  // Get TalentLayerID contract
  const talentLayerID = await ethers.getContractAt(
    'TalentLayerID',
    get(hre.network.name as any as Network, ConfigProperty.TalentLayerID),
  )

  const talentLayerPlatformID = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(hre.network.name as any as Network, ConfigProperty.TalentLayerPlatformID),
    deployer,
  )

  // Mint platform id for Alice
  const mintRole = await talentLayerPlatformID.MINT_ROLE()
  await talentLayerPlatformID.connect(deployer).grantRole(mintRole, alice.address)
  await talentLayerPlatformID.connect(alice).mint('AlicePlat')

  // Deploy mock forwarder
  // const MockForwarder = await ethers.getContractFactory('MockForwarder')
  // const mockForwarder = await MockForwarder.deploy()

  // const addForwarderTx = await talentLayerID.connect(deployer).addTrustedForwarder(mockForwarder.address)
  // await addForwarderTx.wait()

  // Meta-transaction to mint a TalentLayer ID for Bob
  // const req = {
  //   from: bob.address,
  //   to: talentLayerID.address,
  //   value: 0,
  //   gas: 29022296,
  //   nonce: 0,
  //   data: talentLayerID.interface.encodeFunctionData('mint', [1, 'bob']),
  //   validUntilTime: 0,
  // }

  // // Relayer sends the meta-transaction to the forwarder
  // const tx = await mockForwarder.connect(relayer).execute(req)
  // const receipt = await tx.wait()

  const tx = await talentLayerID.connect(bob).mint(1, 'bob')
  const receipt = await tx.wait()

  console.log('Gas used:', receipt.gasUsed.toString())
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
