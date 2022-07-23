import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners()
  const joRe = await ethers.getContractAt('JobRegistry', "0x4aE6B4edD82c75bbA8e29B44aD4829708D5cEc8e")
  await joRe.connect(bob).createJobFromEmployer(2, `ipfs://ssss`)
  console.log("Job created");
  await joRe.connect(carol).confirmJob(1)
  console.log("Job confirmed");
  await joRe.connect(bob).finishJob(1)
  console.log("Job finished");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});