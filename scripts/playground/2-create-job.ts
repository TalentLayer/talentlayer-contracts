import { ethers } from "hardhat";

async function main() {
  const [alice] = await ethers.getSigners();
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    "0x1eC0abD9539638FDb05EeD904Ca6F617BfBD6DCC"
  );

  await jobRegistry.connect(alice).createOpenJobFromEmployer("ipfs://ssss");
  console.log("Open Job created");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
