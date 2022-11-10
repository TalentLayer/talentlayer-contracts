import { ethers } from 'hardhat'
import { get, ConfigProperty } from '../../configManager'
import { Network } from '../config'
const hre = require('hardhat')

// Alice accept the Carol proposal
async function main() {
  const network = await hre.network.name
  console.log(network)

  const [alice, bob, carol, dave] = await ethers.getSigners()
  const serviceRegistry = await ethers.getContractAt(
    'ServiceRegistry',
    get(network as Network, ConfigProperty.ServiceRegistry),
  )

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    "TalentLayerMultipleArbitrableTransaction",
    get(
      network as Network,
      ConfigProperty.TalentLayerMultipleArbitrableTransaction
    )
  );

  const platformIdContrat = await ethers.getContractAt(
    'TalentLayerPlatformID',
    get(network as Network, ConfigProperty.TalentLayerPlatformID),
  )

  // const rateToken = "0x0000000000000000000000000000000000000000";
  let serviceId = await serviceRegistry.nextServiceId();
  serviceId = serviceId.sub(1);
  console.log("serviceId", serviceId.toString());

  const rateAmount = 20000000000000;
  const daveTlId = await platformIdContrat.getPlatformIdFromAddress(dave.address);
  await platformIdContrat.connect(dave).updatePlatformfee(daveTlId, 1100);
  const davePlatformData = await platformIdContrat.platforms(daveTlId);
  const protocolFee = await talentLayerMultipleArbitrableTransaction.protocolFeePerTenThousand();
  const originPlatformFee = await talentLayerMultipleArbitrableTransaction.originPlatformFeePerTenThousand();
  const platformFee = davePlatformData.fee;

  const totalAmount = rateAmount + (rateAmount * (protocolFee + originPlatformFee + platformFee) / 10000)

  await talentLayerMultipleArbitrableTransaction
    .connect(alice)
    .createETHTransaction(
      3600 * 24 * 7,
      "_metaEvidence",
      serviceId,
      3, //proposalId/talentLayerId of carol.
      { value: totalAmount }
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
