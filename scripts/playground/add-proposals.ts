import { ethers } from "hardhat";

async function main() {
  const [alice, bob, carol, dave] = await ethers.getSigners();

  // FIRST Mint a TL for everyone
  const tlID = await ethers.getContractAt('TalentLayerID', "0x9FDc1ade9D4a2518eC5C5c01f683E312d1970f3C")

  const aliceTlID = await tlID.walletOfOwner(alice.address)
  if(!aliceTlID){
      await tlID.connect(alice).mint("alice.lens")
      console.log("alice.lens registered");
  }

  const bobTlID = await tlID.walletOfOwner(bob.address)
  if(!bobTlID){
    await tlID.connect(bob).mintWithPoh("bob.lens")
    console.log("Bob.lens registered")
  }

  const carolTlID = await tlID.walletOfOwner(carol.address)
  if(!carolTlID){
    await tlID.connect(carol).mintWithPoh("carol.lens")
    console.log("carol.lens registered");
  }

  const daveTlID = await tlID.walletOfOwner(dave.address)
  if(!daveTlID){
    await tlID.connect(dave).mint("dave.lens")
    console.log("dave.lens registered");
  }

  // Check data
  console.log({
    aliceTlID, bobTlID, carolTlID, daveTlID
  })


  // Then Alice create a job, and others add proposals
  const jobRegistry = await ethers.getContractAt(
    "JobRegistry",
    "0x863751792aa2DAb3554b08B5ba9B336B134ae3ed"
  );

  const jobId = await jobRegistry.nextJobId();
  console.log("jobId", jobId.toString());

  await jobRegistry.connect(alice).createOpenJobFromEmployer("ipfs://ssss");
  console.log("Open Job created");
  
  //Bob make a proposal
  const rateTokenBob = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
  await jobRegistry.connect(bob).createProposal(jobId, rateTokenBob, 10, "ipfs://bob");
  
  //Carol make a proposal
  const rateTokenCarol = "0xba401cdac1a3b6aeede21c9c4a483be6c29f88c5";
  await jobRegistry
    .connect(carol)
    .createProposal(jobId, rateTokenCarol, 200, "ipfs://carol");

  // Dave make a proposal
  const rateTokenDave = "0x4675c7e5baafbffbca748158becba61ef3b0a263";
  await jobRegistry
    .connect(dave)
    .createProposal(jobId, rateTokenDave, 45, "ipfs://dave");

  //Bob update his proposal
  await jobRegistry
    .connect(bob)
    .updateProposal(jobId, rateTokenBob, 13, "ipfs://bobUpdateProposal");

  //Alice rejected Bob proposal
  await jobRegistry.connect(alice).rejectProposal(jobId, 1);

  console.log("Script ended");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
