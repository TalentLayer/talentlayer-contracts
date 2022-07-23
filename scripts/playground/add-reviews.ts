import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners()
  const tlRe = await ethers.getContractAt('TalentLayerReview', "0x690113a1965781e272E30DE287a0bbBd62f63269")
  await tlRe.connect(bob).addReview(4, "ipfs://review")
  console.log("Bob reviewed Carol");
  await tlRe.connect(carol).addReview(4, "ipfs://review")
  console.log("Carol reviewed Bob");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});