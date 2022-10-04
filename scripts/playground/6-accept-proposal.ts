import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

// Alice accept the Carol proposal
async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice, bob, carol, dave] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    get(network as Network, ConfigProperty.JobRegistry)
  );

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    "TalentLayerMultipleArbitrableTransaction",
    get(
      network as Network,
      ConfigProperty.TalentLayerMultipleArbitrableTransaction
    )
  );
  const rateToken = "0x0000000000000000000000000000000000000000";
  const rateAmount = 100;
  const adminFeeAmount = 10;

  let jobId = await jobRegistry.nextJobId();
  jobId = jobId.sub(1);
  console.log("jobId", jobId.toString());

  await talentLayerMultipleArbitrableTransaction
    .connect(alice)
    .createETHTransaction(
      3600 * 24 * 7,
      alice.address,
      carol.address,
      "_metaEvidence",
      rateAmount,
      bob.address,
      adminFeeAmount,
      jobId,
      3,
      { value: rateAmount + adminFeeAmount }
    );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
