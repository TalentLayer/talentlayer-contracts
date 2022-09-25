import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
const hre = require("hardhat");

// Then Alice create a job, and others add proposals
async function main() {
  const network = await hre.network.name;
  console.log(network);

  const [alice] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    get(network as Network, ConfigProperty.JobRegistry)
  );

  let jobId = await jobRegistry.nextJobId();
  jobId = jobId.sub(1);
  console.log("jobId", jobId.toString());

  //Alice rejected Bob proposal
  await jobRegistry.connect(alice).rejectProposal(jobId, 2);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
