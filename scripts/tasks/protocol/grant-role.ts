import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to grant a role on a upgradeable contract
 * @usage npx hardhat grant-role --contract-name "TalentLayerPlatformID" --address 0x99f117069F9ED15476003502AD8D96107A180648 --network mumbai
 */
task('grant-role', 'Transfer role to a new address')
  .addParam('contractName', 'The name of the contract')
  .addParam('address', 'The address of the new owner')
  .setAction(async (args, { ethers, network }) => {
    const { address, contractName } = args
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)
    console.log('Grant role from:', deployer.address, 'to:', address, 'for contract:', contractName)

    const ProxyContract = await ethers.getContractFactory(contractName)

    const proxyAddress = getDeploymentProperty(
      network.name,
      DeploymentProperty[contractName as keyof typeof DeploymentProperty],
    )
    if (!proxyAddress) {
      throw new Error(`Proxy address not found for ${contractName}`)
    }

    // @ts-ignore ProxyContract will be one of the contracts that we have deployed
    const proxyContract = await ProxyContract.attach(proxyAddress)
    const role = await proxyContract.DEFAULT_ADMIN_ROLE()
    const tx = await proxyContract.grantRole(role, address)

    console.log('Transferred role to:', address, 'tx:', tx.hash)
  })
