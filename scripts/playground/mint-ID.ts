import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners()
  console.log({alice: alice.address, bob: bob.address, carol: carol.address})
  const tlID = await ethers.getContractAt('TalentLayerID', "0x05D8A2E01EB06c284ECBae607A2d0c2BE946Bf49")

  await tlID.connect(alice).mint("alice.lens")
  console.log("alice.lens registered");

  await tlID.connect(bob).mintWithPoh("bob.lens")
  console.log("Bob.lens registered")

  await tlID.connect(carol).mintWithPoh("carol.lens")
  console.log("carol.lens registered");

  const supply = await tlID.handles(1);
  console.log(supply);

  const aliceId = await tlID.walletOfOwner(alice.address)
  console.log(aliceId)
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
