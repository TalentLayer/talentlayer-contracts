import { task } from 'hardhat/config'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'

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
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerID),
    )

    const talentLayerService = await ethers.getContractAt(
      'TalentLayerService',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerService),
    )

    const talentLayerReview = await ethers.getContractAt(
      'TalentLayerReview',
      getDeploymentProperty(network.name, DeploymentProperty.Reviewscontract),
    )

    const talentLayerEscrow = await ethers.getContractAt(
      'TalentLayerEscrow',
      getDeploymentProperty(network.name, DeploymentProperty.TalentLayerEscrow),
    )

    const talentLayerIdTx = await talentLayerId.addTrustedForwarder(address)
    await talentLayerIdTx.wait()

    const talentLayerServiceTx = await talentLayerService.addTrustedForwarder(address)
    await talentLayerServiceTx.wait()

    const talentLayerReviewTx = await talentLayerReview.addTrustedForwarder(address)
    await talentLayerReviewTx.wait()

    const talentLayerEscrowTx = await talentLayerEscrow.addTrustedForwarder(address)
    await talentLayerEscrowTx.wait()

    console.log(`Added trusted forwarder: ${address}`)
  })
