import { ethers } from "hardhat";

// Then Alice create a job, and others add proposals
async function main() {
  const [alice] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    "0x1eC0abD9539638FDb05EeD904Ca6F617BfBD6DCC"
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
