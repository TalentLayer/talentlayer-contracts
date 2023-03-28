import { HardhatUpgrades } from '@openzeppelin/hardhat-upgrades'
import { ContractFactory } from 'ethers'
import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
import { getConfig, Network, NetworkConfig } from '../../../networkConfig'
import { verifyAddress } from './utils'

/**
 * @notice This task is used to prepare an upgrade for one of the proxy and send a proposal to Defender
 * @usage
 *  - npx hardhat prepare-upgrade --contract-name "TalentLayerServiceV2" --proxy-name "TalentLayerService" --verify --network mumbai
 *  - npx hardhat prepare-upgrade --contract-name "TalentLayerServiceV2" --proxy-name "TalentLayerService" --automatic-proposal --verify --network mumbai
 */
task('prepare-upgrade', 'Prepare an upgrade of a new implementation for one of the proxy')
  .addParam('contractName', 'The name of the new contract implementation')
  .addParam('proxyName', 'The name of the original proxy')
  .addFlag('automaticProposal', 'Use defender CLI to automatically send a proposal')
  .addFlag('verify', 'verify contracts on etherscan')
  .setAction(async (args, { ethers, network }) => {
    const { proxyName, contractName, automaticProposal, verify } = args
    const [deployer] = await ethers.getSigners()
    const chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
    const networkConfig: NetworkConfig = getConfig(chainId)

    console.log('network', network.name)
    console.log(
      'Prepare upgrade by:',
      deployer.address,
      'for proxy contract:',
      proxyName,
      'with new implementation:',
      contractName,
    )

    const proxyAddress = getDeploymentProperty(
      network.name,
      DeploymentProperty[proxyName as keyof typeof DeploymentProperty],
    )
    if (!proxyAddress) {
      throw new Error(`Proxy address not found for ${proxyName}`)
    }

    const NewImplementation = await ethers.getContractFactory(contractName)

    let newImplementationAddress
    if (automaticProposal) {
      // @ts-ignore: defender is imported in hardhat.config.ts
      const proposal = await defender.proposeUpgrade(proxyAddress, NewImplementation, {
        multisig: networkConfig.multisigAddressList.admin,
      })
      newImplementationAddress = proposal.metadata.newImplementationAddress
      console.log('Upgrade proposal created at:', proposal.url)
    } else {
      // @ts-ignore: upgrades is imported in hardhat.config.ts
      newImplementationAddress = await (upgrades as HardhatUpgrades).prepareUpgrade(
        proxyAddress,
        NewImplementation as ContractFactory,
      )
    }

    if (verify) {
      await verifyAddress(newImplementationAddress as string)
    }

    console.log('New implementation deployed:', newImplementationAddress)
  })
