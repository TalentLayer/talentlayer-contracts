import { ethers } from "hardhat";
import { get, ConfigProperty } from "../../configManager";
import { Network } from "../config";
import postToIPFS from "../ipfs";

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

  const bobUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: "Javascript Developer",
      proposalAbout: "We looking for Javascript Developer",
      rateType: 3,
      expectedHours: 50,
    })
  );

  const carolUri = await postToIPFS(
    JSON.stringify({
      proposalTitle: "C++ developer",
      proposalAbout: "We are looking for a C++ developer",
      rateType: 4,
      expectedHours: 20,
    })
  );

  console.log("uri", bobUri);

  const rateTokenBob = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
  await jobRegistry
    .connect(bob)
    .createProposal(jobId, rateTokenBob, 10, bobUri);

  // Carol make a proposal
  // const rateTokenCarol = "0xba401cdac1a3b6aeede21c9c4a483be6c29f88c5";
  const rateTokenCarol = "0x0000000000000000000000000000000000000000";
  await jobRegistry
    .connect(carol)
    .createProposal(jobId, rateTokenCarol, 200, carolUri);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
