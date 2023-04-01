import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

/**
 * @notice This task is used to transfer ownership on a upgradeable contract
 * @usage npx hardhat transfer-ownership --contract-name "TalentLayerService" --address 0x99f117069F9ED15476003502AD8D96107A180648 --network mumbai
 */
task('transfer-ownership', 'Transfer ownership of the contract to a new address')
  .addParam('contractName', 'The name of the contract')
  .addParam('address', 'The address of the new owner')
  .setAction(async (args, { ethers, network }) => {
    const { address, contractName } = args
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)
    console.log(
      'Transferring ownership of ProxyAdmin from:',
      deployer.address,
      'to:',
      address,
      'for contract:',
      contractName,
    )

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
    const tx = await proxyContract.transferOwnership(address)

    console.log('Transferred ownership to:', address, 'tx:', tx.hash)
  })
