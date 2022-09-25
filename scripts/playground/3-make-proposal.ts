import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

// Then Alice create a job, and others add proposals
async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice, bob, carol, dave] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    get(network as Network, ConfigProperty.JobRegistry)
  );

  let jobId = await jobRegistry.nextJobId();
  jobId = jobId.sub(1);
  console.log("jobId", jobId.toString());

  //Bob make a proposal
  const rateTokenBob = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
  await jobRegistry
    .connect(bob)
    .createProposal(jobId, rateTokenBob, 10, "ipfs://bob");

  //Carol make a proposal
  const rateTokenCarol = "0xba401cdac1a3b6aeede21c9c4a483be6c29f88c5";
  await jobRegistry
    .connect(carol)
    .createProposal(jobId, rateTokenCarol, 200, "ipfs://carol");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
