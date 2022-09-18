import { ethers } from "hardhat";

// Then Alice create a job, and others add proposals
async function main() {
  const [alice] = await ethers.getSigners();

  const talentLayerMultipleArbitrableTransaction = await ethers.getContractAt(
    "TalentLayerMultipleArbitrableTransaction",
    "0x45E8F869Fd316741A9316f39bF09AD03Df88496f"
  );

  await talentLayerMultipleArbitrableTransaction.connect(alice).pay(0, 30)
  await talentLayerMultipleArbitrableTransaction.connect(alice).pay(0, 70)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
