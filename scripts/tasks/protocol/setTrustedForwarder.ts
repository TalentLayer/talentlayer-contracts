import { task } from 'hardhat/config'
import { Network } from '../../config'
import { ConfigProperty, get } from '../../../configManager'

/**
 * @notice This task is used to set a trusted forwarder for meta transactions.
 * @param {uint} address - the address of the forwarder
 * @dev Example of script use:
 * npx hardhat set-trusted-forwarder --network localhost --address 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
 */
task('set-trusted-forwarder', 'Sets trusted forwarder for meta transactions.')
  .addParam('address', "The forwarder's address")
  .setAction(async (taskArgs, { network, ethers }) => {
    const { address } = taskArgs

    console.log('network', network.name)
    console.log('Address: ', address)

    const talentLayerIdContract = await ethers.getContractAt(
      'TalentLayerID',
      get(network.name as any as Network, ConfigProperty.TalentLayerID),
    )

    await talentLayerIdContract.setTrustedForwarder(address)

    console.log(`Set trusted forwarder: ${address}`)
  })
