import { ethers } from "hardhat";

// Alice accept the Carol proposal
async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners();

  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    "0x1eC0abD9539638FDb05EeD904Ca6F617BfBD6DCC"
  );

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    "TalentLayerMultipleArbitrableTransaction",
    "0x7f606e9868283A46c050515eD70ac13B46dB845b"
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
