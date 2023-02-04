import { HardhatUpgrades } from '@openzeppelin/hardhat-upgrades'
import { task } from 'hardhat/config'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../utils/config'
import { verifyAddress } from './utils'

/**
 * @notice This task is used to prepare an upgrade for one of the proxy and send a proposal to Defender
 * @usage npx hardhat prepare-upgrade --contract-name "ServiceRegistryV2" --proxy-name "ServiceRegistry" --verify --network goerli
 */
task('prepare-upgrade', 'Prepare an upgrade of a new implementation for one of the proxy')
  .addParam('contractName', 'The name of the new contract implemntation')
  .addParam('proxyName', 'The name of the original proxy')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, network }) => {
    const { proxyName, contractName, verify } = args
    const [deployer] = await ethers.getSigners()

    console.log('network', network.name)
    console.log(
      'Prepare upgrade by:',
      deployer.address,
      'for proxy contract:',
      proxyName,
      'with new implementation:',
      contractName,
    )

    const proxyAddress = get((network.name as any) as Network, ConfigProperty[proxyName as keyof typeof ConfigProperty])
    if (!proxyAddress) {
      throw new Error(`Proxy address not found for ${proxyName}`)
    }

    const NewImplementation = await ethers.getContractFactory(contractName)
    // @ts-ignore: upgrades is imported in hardhat.config.ts
    const newImplementationAddress = await (upgrades as HardhatUpgrades).prepareUpgrade(proxyAddress, NewImplementation)

    if (verify) {
      await verifyAddress(newImplementationAddress as string)
    }

    console.log('New implementation deployed:', newImplementationAddress)
  })
