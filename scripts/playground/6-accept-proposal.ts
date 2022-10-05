import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

// Alice accept the Carol proposal
async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice, bob, carol, dave] = await ethers.getSigners();

  /*-----------------*/

  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    get(network as Network, ConfigProperty.JobRegistry)
  );
  console.log("jobRegistry", jobRegistry.address);

  const talentLayerID = await ethers.getContractAt(
    "TalentLayerID",
    get(network as Network, ConfigProperty.TalentLayerID)
  );
  console.log("talentLayerID", talentLayerID.address);

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    "TalentLayerMultipleArbitrableTransaction",
    get(
      network as Network,
      ConfigProperty.TalentLayerMultipleArbitrableTransaction
    )
  );

  console.log(
    "TalentLayerMultipleArbitrableTransaction",
    talentLayerMultipleArbitrableTransaction.address
  );

  /*-----------------*/

  const bobTid = await talentLayerID.walletOfOwner(bob.address);
  const carolTid = await talentLayerID.walletOfOwner(carol.address);
  console.log("bobTid", bobTid.toString());

  const simpleERC20 = await ethers.getContractAt(
    "SimpleERC20",
    get(network as Network, ConfigProperty.SimpleERC20)
  );
  console.log("ERC20", simpleERC20.address);

  const adminWallet = "0x0000000000000000000000000000000000000000";
  const rateAmount = 200;
  const adminFeeAmount = 10;
  const proposalId = 3;

  let jobId = await jobRegistry.nextJobId();
  jobId = jobId.sub(1);
  console.log("jobId", jobId.toString());

  //get balance alice wallet
  const balanceAlice = await simpleERC20.balanceOf(alice.address);
  await simpleERC20.transfer(alice.address, 10000);
  console.log("balanceAlice", balanceAlice.toString());

  await simpleERC20
    .connect(alice)
    .approve(
      talentLayerMultipleArbitrableTransaction.address,
      rateAmount + adminFeeAmount
    );

  const aliceAllowance = await simpleERC20.allowance(
    alice.address,
    talentLayerMultipleArbitrableTransaction.address
  );
  console.log("Alice allowance : ", aliceAllowance);

  await talentLayerMultipleArbitrableTransaction
    .connect(alice)
    .createTransaction(
      3600 * 24 * 7,
      "_metaEvidence",
      carol.address,
      adminFeeAmount,
      jobId,
      proposalId,
      { value: rateAmount + adminFeeAmount }
    );

  //   //TODO: Simple check - can be deleted
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
