import { task } from 'hardhat/config'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import fs from 'fs'
import path from 'path'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to set the whitelist for minting reserved handles
 * @param {string} file - The path to the JSON file containing the whitelist
 * @dev Example of script use: "npx hardhat set-profile-whitelist --file whitelist.json --network mumbai"
 */
task('set-profile-whitelist', 'Sets the whitelist for minting profiles with reserved handles')
  .addParam('file', 'The path to the file containing the whitelist')
  .setAction(async (taskArgs, { ethers, network }) => {
    const { file: filePath } = taskArgs
    console.log('network', network.name)

    const whitelistPath = path.resolve(__dirname, '../../../', filePath)
    const whitelistFile = fs.readFileSync(whitelistPath)
    const whitelist = JSON.parse(whitelistFile.toString())

    console.log('Whitelist: ', whitelist)

    const talentLayerID = await ethers.getContractAt(
      'TalentLayerID',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    // Set whitelist merkle root
    const merkleTree = new MerkleTree(whitelist, keccak256, {
      hashLeaves: true,
      sortPairs: true,
    })
    const merkleRoot = merkleTree.getHexRoot()
    await talentLayerID.setWhitelistMerkleRoot(merkleRoot)

    console.log(`Set whitelist merkle root`)
  })
