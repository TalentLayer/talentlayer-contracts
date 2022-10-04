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

  //TODO: Set correct ERC20 address
  const erc20 = await ethers.getContractAt(
    "ERC20",
    "0xba401cdac1a3b6aeede21c9c4a483be6c29f88c5",
  );

  const adminWallet = "0x0000000000000000000000000000000000000000";
  const rateAmount = 100;
  const adminFeeAmount = 0;
  const proposalId = 3;
  const value = rateAmount + adminFeeAmount;

  let jobId = await jobRegistry.nextJobId();

  jobId = jobId.sub(1);

  console.log("jobId", jobId.toString());

  /*TODO: Deploy test ERC20
  - Give balance to Alice
  - Approve transaction from Alice to escrow contract
  */

  // If token payment => Need to approve token allowance first
  await erc20.approve(talentLayerMultipleArbitrableTransaction.address, value);

  await talentLayerMultipleArbitrableTransaction
    .connect(alice)
    .createTransaction(
      3600 * 24 * 7,
      "_metaEvidence",
      adminWallet,
      adminFeeAmount,
      jobId,
      proposalId,
      { value: value }
    );

  //TODO: Simple check - can be deleted
  const transactionCount = await talentLayerMultipleArbitrableTransaction
      .connect(alice)
      .getCountTransactions();
  console.log("TransactionCount ", transactionCount);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
