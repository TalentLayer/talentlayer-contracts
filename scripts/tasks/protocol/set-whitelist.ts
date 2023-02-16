import { task } from 'hardhat/config'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

const reservedHandles = ['alice', 'bob', 'carol']
const whitelist = [
  '0x8d960334c2ef30f425b395c1506ef7c5783789f3;alice',
  '0x0f45421e8dc47ef9edd8568a9d569b6fc7aa7ac6;bob',
  '0x997b456be586997a2f6d6d650fc14bf5843c92b2;carol',
]

/**
 * @notice This task is used to set the whitelist period for minting reserved handles
 * @dev Example of script use: "npx hardhat set-whitelist --network mumbai"
 */
task('set-whitelist', 'Sets the whitelist period for minting reserved handles').setAction(
  async (_, { ethers, network }) => {
    console.log('network', network.name)

    const talentLayerID = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    // Set whitelist merkle root
    const whitelistMerkleTree = new MerkleTree(whitelist, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    })
    const whitelistMerkleRoot = whitelistMerkleTree.getHexRoot()
    await talentLayerID.setWhitelistMerkleRoot(whitelistMerkleRoot)

    console.log(`Set whitelist merkle root`)

    // Set reserved handles merkle root
    const handlesMerkleTree = new MerkleTree(reservedHandles, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    })
    const handlesMerkleRoot = handlesMerkleTree.getHexRoot()
    await talentLayerID.setReservedHandlesMerkleRoot(handlesMerkleRoot)

    console.log(`Set reserved handles merkle root`)
  },
)
