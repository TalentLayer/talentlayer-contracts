import { task } from 'hardhat/config'
import { ConfigProperty, get } from '../../../configManager'
import { Network } from '../../utils/config'

/**
 * @notice This task is used to add a trusted forwarder for meta transactions
 *         in all the ERC-2771 compatible contracts
 * @param {string} address - the address of the forwarder
 * @dev Example of script use:
 * npx hardhat add-trusted-forwarder --network localhost --address 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
 */
task('add-trusted-forwarder', 'Adds a trusted forwarder for meta transactions.')
  .addParam('address', "The forwarder's address")
  .setAction(async (taskArgs, { network, ethers }) => {
    const { address } = taskArgs

    console.log('network', network.name)

    const talentLayerId = await ethers.getContractAt(
      'TalentLayerID',
      get(network.name as any as Network, ConfigProperty.TalentLayerID),
    )

    const serviceRegistry = await ethers.getContractAt(
      'ServiceRegistry',
      get(network.name as any as Network, ConfigProperty.ServiceRegistry),
    )

    const talentLayerReview = await ethers.getContractAt(
      'TalentLayerReview',
      get(network.name as any as Network, ConfigProperty.Reviewscontract),
    )

    const talentLayerEscrow = await ethers.getContractAt(
      'TalentLayerEscrow',
      get(network.name as any as Network, ConfigProperty.TalentLayerEscrow),
    )

    const talentLayerIdTx = await talentLayerId.addTrustedForwarder(address)
    await talentLayerIdTx.wait()

    const serviceRegistryTx = await serviceRegistry.addTrustedForwarder(address)
    await serviceRegistryTx.wait()

    const talentLayerReviewTx = await talentLayerReview.addTrustedForwarder(address)
    await talentLayerReviewTx.wait()

    const talentLayerEscrowTx = await talentLayerEscrow.addTrustedForwarder(address)
    await talentLayerEscrowTx.wait()

    console.log(`Added trusted forwarder: ${address}`)
  })
