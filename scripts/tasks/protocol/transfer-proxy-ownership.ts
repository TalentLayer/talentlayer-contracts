import { task } from 'hardhat/config'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../utils/config'

/**
 * @notice This task is used to transfer ownership of one proxy
 * @usage npx hardhat transfer-proxy-ownership --contract-name "ServiceRegistry" --address 0x99f117069F9ED15476003502AD8D96107A180648 --network goerli
 */
task('transfer-proxy-ownership', 'Transfer ownership of proxy admin to a new address')
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

    const proxyAddress = get(
      network.name as any as Network,
      ConfigProperty[contractName as keyof typeof ConfigProperty],
    )
    if (!proxyAddress) {
      throw new Error(`Proxy address not found for ${contractName}`)
    }

    // @ts-ignore ProxyContract will be one of the contracts that we have deployed
    const proxyContract = await ProxyContract.attach(proxyAddress)
    const tx = await proxyContract.transferOwnership(address)

    console.log('Transferred ownership of ProxyAdmin to:', address, 'tx:', tx.hash)
  })
