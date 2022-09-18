import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol] = await ethers.getSigners();
  console.log({ alice: alice.address, bob: bob.address, carol: carol.address });
  const tlID = await ethers.getContractAt(
    "TalentLayerID",
    "0x48C45A025D154b40AffB41bc3bDEecb689edE7E6"
  );

  await tlID.connect(alice).mint("alice.lens");
  console.log("alice.lens registered");

  await tlID.connect(bob).mintWithPoh("bob.lens");
  console.log("Bob.lens registered");

  await tlID.connect(carol).mintWithPoh("carol.lens");
  console.log("carol.lens registered");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
