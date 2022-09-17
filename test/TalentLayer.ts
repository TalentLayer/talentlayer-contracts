import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract, ContractFactory } from "ethers";

describe("TalentLayer", function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    JobRegistry: ContractFactory,
    TalentLayerID: ContractFactory,
    TalentLayerReview: ContractFactory,
    TalentLayerMultipleArbitrableTransaction: ContractFactory,
    TalentLayerArbitrator: ContractFactory,
    MockProofOfHumanity: ContractFactory,
    jobRegistry: Contract,
    talentLayerID: Contract,
    talentLayerReview: Contract,
    talentLayerMultipleArbitrableTransaction: Contract,
    talentLayerArbitrator: Contract,
    mockProofOfHumanity: Contract;

  before(async function () {
    [deployer, alice, bob, carol, dave] = await ethers.getSigners();

    // Deploy MockProofOfHumanity
    MockProofOfHumanity = await ethers.getContractFactory(
      "MockProofOfHumanity"
    );
    mockProofOfHumanity = await MockProofOfHumanity.deploy();
    mockProofOfHumanity.addSubmissionManually([alice.address, bob.address]);

    // Deploy TalenLayerID
    TalentLayerID = await ethers.getContractFactory("TalentLayerID");
    const talentLayerIDArgs: [string] = [mockProofOfHumanity.address];
    talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs);

    // Deploy JobRegistry
    JobRegistry = await ethers.getContractFactory("JobRegistry");
    jobRegistry = await JobRegistry.deploy(talentLayerID.address);

    // Deploy TalentLayerReview
    TalentLayerReview = await ethers.getContractFactory("TalentLayerReview");
    talentLayerReview = await TalentLayerReview.deploy(
      "TalentLayer Review",
      "TLR",
      talentLayerID.address,
      jobRegistry.address
    );

    // Deploy TalentLayerArbitrator
    TalentLayerArbitrator = await ethers.getContractFactory("TalentLayerArbitrator");
    talentLayerArbitrator = await TalentLayerArbitrator.deploy(0);

    // Deploy TalentLayerMultipleArbitrableTransaction
    TalentLayerMultipleArbitrableTransaction = await ethers.getContractFactory("TalentLayerMultipleArbitrableTransaction");
    talentLayerMultipleArbitrableTransaction = await TalentLayerMultipleArbitrableTransaction.deploy(
      jobRegistry.address,
      talentLayerID.address,
      talentLayerArbitrator.address,
      [],
      3600*24*30
    );

    // Grant escrow role 
    const escrowRole = await jobRegistry.ESCROW_ROLE()
    await jobRegistry.grantRole(escrowRole, talentLayerMultipleArbitrableTransaction.address)
  });

  it("Alice, Bob and Carol can mint a talentLayerId", async function () {
    await talentLayerID.connect(alice).mintWithPoh("alice");
    await talentLayerID.connect(bob).mintWithPoh("bob");

    expect(
      talentLayerID.connect(carol).mintWithPoh("carol")
    ).to.be.revertedWith(
      "You need to use an address registered on Proof of Humanity"
    );
    await talentLayerID.connect(carol).mint("carol");

    expect(await talentLayerID.walletOfOwner(alice.address)).to.be.equal("1");
    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal("2");
    expect(await talentLayerID.walletOfOwner(carol.address)).to.be.equal("3");
  });

  it("Carol can activate POH on her talentLayerID", async function () {
    expect(
      talentLayerID.connect(carol).mintWithPoh("carol")
    ).to.be.revertedWith("You're address is not registerd for poh");
    await mockProofOfHumanity.addSubmissionManually([carol.address]);
    await talentLayerID.connect(carol).activatePoh(3);
    expect(await talentLayerID.isTokenPohRegistered(3)).to.be.equal(true);
    expect(await talentLayerID.talentIdPohAddresses(3)).to.be.equal(
      carol.address
    );
  });

  it("Alice, the employer, can initiate a new job with Bob, the employee", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).createJobFromEmployer(bobTid, "cid");
    const jobData = await jobRegistry.jobs(1);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employerId.toString()).to.be.equal("1");
    expect(jobData.initiatorId.toString()).to.be.equal("1");
    expect(jobData.employeeId.toString()).to.be.equal("2");
    expect(jobData.jobDataUri).to.be.equal("cid");
  });

  it("Alice can't create a new job with a talentLayerId 0", async function () {
    expect(
      jobRegistry.connect(alice).createJobFromEmployer(0, "cid")
    ).to.be.revertedWith("Employee 0 is not a valid TalentLayerId");
    expect(
      jobRegistry.connect(alice).createJobFromEmployee(0, "cid")
    ).to.be.revertedWith("Employer 0 is not a valid TalentLayerId");
  });

  it("Bob, the employee, can confrim the job, Alice can't, Carol can't", async function () {
    expect(jobRegistry.connect(alice).confirmJob(1)).to.be.revertedWith(
      "Only the user who didn't initate the job can confirm it"
    );
    expect(jobRegistry.connect(carol).confirmJob(1)).to.be.revertedWith(
      "You're not an actor of this job"
    );
    await jobRegistry.connect(bob).confirmJob(1);
    const jobData = await jobRegistry.jobs(1);
    expect(jobData.status.toString()).to.be.equal("1");
    expect(jobRegistry.connect(bob).confirmJob(1)).to.be.revertedWith(
      "Job has already been confirmed"
    );
  });

  it("Bob can't write a review yet", async function () {
    expect(
      talentLayerReview.connect(bob).addReview(1, "cidReview", 3)
    ).to.be.revertedWith("The job is not finished yet");
  });

  it("Carol can't write a review as she's not linked to this job", async function () {
    expect(
      talentLayerReview.connect(carol).addReview(1, "cidReview", 5)
    ).to.be.revertedWith("You're not an actor of this job");
  });

  it("Alice can say that the job is finished", async function () {
    await jobRegistry.connect(alice).finishJob(1);
    const jobData = await jobRegistry.jobs(1);
    expect(jobData.status.toString()).to.be.equal("2");
  });

  it("Alice and Bob can write a review now and we can get review data", async function () {
    await talentLayerReview.connect(alice).addReview(1, "cidReview1", 2);
    await talentLayerReview.connect(bob).addReview(1, "cidReview2", 4);

    expect(await talentLayerReview.reviewDataUri(0)).to.be.equal("cidReview1");
    expect(await talentLayerReview.reviewDataUri(1)).to.be.equal("cidReview2");
  });

  it("Alice and Bob can't write a review for the same Job", async function () {
    expect(
      talentLayerReview.connect(alice).addReview(1, "cidReview", 0)
    ).to.be.revertedWith("ReviewAlreadyMinted()");
    expect(
      talentLayerReview.connect(bob).addReview(1, "cidReview", 3)
    ).to.be.revertedWith("ReviewAlreadyMinted()");
  });

  it("Carol, a new employer, can initiate a new job with Bob, the employee", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(carol).createJobFromEmployer(bobTid, "cid2");
    const jobData = await jobRegistry.jobs(2);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employerId.toString()).to.be.equal("3");
    expect(jobData.initiatorId.toString()).to.be.equal("3");
    expect(jobData.employeeId.toString()).to.be.equal("2");
    expect(jobData.jobDataUri).to.be.equal("cid2");
  });

  it("Bob can reject Carol new job as he's not agree with the job details", async function () {
    await jobRegistry.connect(bob).rejectJob(2);
    const jobData = await jobRegistry.jobs(2);
    expect(jobData.status.toString()).to.be.equal("3");
    expect(jobRegistry.connect(bob).confirmJob(1)).to.be.revertedWith(
      "You can't finish this job"
    );
  });

  it("Bob can post another job with fixed job details, and Carol confirmed it", async function () {
    const carolId = await talentLayerID.walletOfOwner(carol.address);
    await jobRegistry.connect(bob).createJobFromEmployee(carolId, "cid3");
    let jobData = await jobRegistry.jobs(3);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employerId.toString()).to.be.equal("3");
    expect(jobData.initiatorId.toString()).to.be.equal("2");
    expect(jobData.employeeId.toString()).to.be.equal("2");
    expect(jobData.jobDataUri).to.be.equal("cid3");

    await jobRegistry.connect(carol).confirmJob(3);
    jobData = await jobRegistry.jobs(3);

    expect(jobData.status.toString()).to.be.equal("1");
  });

  it("Dave, who doesn't have TalentLayerID, can't create a job", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    expect(
      jobRegistry.connect(dave).createJobFromEmployer(bobTid, "cid")
    ).to.be.revertedWith("You sould have a TalentLayerId");
  });

  it("Alice the employer can create an Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    const jobData = await jobRegistry.jobs(4);

    expect(jobData.status.toString()).to.be.equal("4");
    expect(jobData.employerId.toString()).to.be.equal("1");
    expect(jobData.initiatorId.toString()).to.be.equal("1");
    expect(jobData.employeeId.toString()).to.be.equal("0");
    expect(jobData.jobDataUri).to.be.equal("cid");
  });

  it("Alice can assign an employee to a Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).assignEmployeeToJob(5, bobTid);
    const jobData = await jobRegistry.jobs(5);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employeeId.toString()).to.be.equal(bobTid);
  });

  it("Bob can confirm the Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).assignEmployeeToJob(6, bobTid);
    await jobRegistry.connect(bob).confirmJob(6);
    const jobData = await jobRegistry.jobs(6);

    expect(jobData.status.toString()).to.be.equal("1");
  });

  it("Bob can reject an Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const carolId = await talentLayerID.walletOfOwner(carol.address);
    await jobRegistry.connect(alice).assignEmployeeToJob(7, bobTid);
    await jobRegistry.connect(bob).rejectJob(7);
    const jobData = await jobRegistry.jobs(7);

    expect(jobData.status.toString()).to.be.equal("3");

    await jobRegistry.connect(alice).assignEmployeeToJob(7, carolId);
    await jobRegistry.connect(carol).confirmJob(7);
    const jobDataNewAssignement = await jobRegistry.jobs(7);

    expect(jobDataNewAssignement.status.toString()).to.be.equal("1");
  });

  it("Bob can create a proposal for an Open job", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const rateToken = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");

    // Proposal data check before the proposal
    const proposalDataBefore = await jobRegistry.getProposal(8, bobTid);
    expect(proposalDataBefore.employeeId.toString()).to.be.equal("0");

    await jobRegistry.connect(bob).createProposal(8, rateToken, 1, "cid");

    const jobData = await jobRegistry.jobs(8);
    const proposalDataAfter = await jobRegistry.getProposal(8, bobTid);

    // Job data check
    expect(jobData.status.toString()).to.be.equal("4");
    expect(jobData.employerId.toString()).to.be.equal("1");

    // Proposal data check after the proposal

    expect(proposalDataAfter.rateToken).to.be.equal(rateToken);
    expect(proposalDataAfter.rateAmount.toString()).to.be.equal("1");
    expect(proposalDataAfter.proposalDataUri).to.be.equal("cid");
    expect(proposalDataAfter.employeeId.toString()).to.be.equal("2");
    expect(proposalDataAfter.status.toString()).to.be.equal("0");
  });

  it("Bob can update a proposal ", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const rateToken = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    await jobRegistry.connect(bob).createProposal(9, rateToken, 1, "cid");

    const proposalDataBefore = await jobRegistry.getProposal(9, bobTid);
    expect(proposalDataBefore.rateAmount.toString()).to.be.equal("1");

    await jobRegistry.connect(bob).updateProposal(9, rateToken, 2, "cid2");

    const proposalDataAfter = await jobRegistry.getProposal(9, bobTid);
    expect(proposalDataAfter.rateAmount.toString()).to.be.equal("2");
    expect(proposalDataAfter.proposalDataUri).to.be.equal("cid2");
  });

  it("Alice can validate a proposal", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const rateToken = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    await jobRegistry.connect(bob).createProposal(10, rateToken, 1, "cid");

    const proposalDataBefore = await jobRegistry.getProposal(10, bobTid);
    expect(proposalDataBefore.status.toString()).to.be.equal("0");

    await jobRegistry.connect(alice).validateProposal(10, bobTid);

    const proposalDataAfter = await jobRegistry.getProposal(10, bobTid);
    expect(proposalDataAfter.status.toString()).to.be.equal("1");
  });

  it("Alice can delete a proposal ", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const rateToken = "0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10";
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    await jobRegistry.connect(bob).createProposal(11, rateToken, 1, "cid");

    await jobRegistry.connect(alice).rejectProposal(11, bobTid);

    const proposalDataAfter = await jobRegistry.getProposal(11, bobTid);
    expect(proposalDataAfter.status.toString()).to.be.equal("2");
  });

  it("Alice can validate a proposal by sending funds to escrow", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    const rateToken = "0x0000000000000000000000000000000000000000";
    const rateAmount = 100;
    const adminFeeAmount = 10;
    await jobRegistry.connect(alice).createOpenJobFromEmployer("cid");
    await jobRegistry.connect(bob).createProposal(12, rateToken, rateAmount, "cid");

    await talentLayerMultipleArbitrableTransaction.connect(alice).createETHTransaction(
      3600*24*7,
      alice.address,
      bob.address,
      '_metaEvidence',
      rateAmount,
      carol.address,
      adminFeeAmount,
      12,
      bobTid, 
      {'value': rateAmount + adminFeeAmount}
    )

    const proposalDataAfter = await jobRegistry.getProposal(12, bobTid)
    const jobDataAfter = await jobRegistry.getJob(12)
    expect(proposalDataAfter.status.toString()).to.be.equal("1")
    expect(jobDataAfter.status.toString()).to.be.equal("1")
    expect(jobDataAfter.transactionId.toString()).to.be.equal("0")
    expect(jobDataAfter.employeeId.toString()).to.be.equal(bobTid)

    const escrowBalance = await ethers.provider.getBalance(talentLayerMultipleArbitrableTransaction.address)
    expect(escrowBalance).to.be.equal(rateAmount + adminFeeAmount)
  });

  it("Alice can pay Bob, first 30%, then the remaining 70%", async function () {
    const bobBalanceStep0 = await ethers.provider.getBalance(bob.address)

    // First 30% pay
    await talentLayerMultipleArbitrableTransaction.connect(alice).pay(0, 30)

    const escrowBalanceStep1 = await ethers.provider.getBalance(talentLayerMultipleArbitrableTransaction.address)
    expect(escrowBalanceStep1).to.be.equal(80)

    const jobDataStep1 = await jobRegistry.getJob(12)
    expect(jobDataStep1.status.toString()).to.be.equal("1")

    const bobBalanceStep1 = await ethers.provider.getBalance(bob.address)
    expect(bobBalanceStep1).to.be.equal(bobBalanceStep0.add(30))

    // Last 70% pay
    await talentLayerMultipleArbitrableTransaction.connect(alice).pay(0, 70)
    const escrowBalanceStep2 = await ethers.provider.getBalance(talentLayerMultipleArbitrableTransaction.address)
    expect(escrowBalanceStep2).to.be.equal(10)

    const bobBalanceStep2 = await ethers.provider.getBalance(bob.address)
    expect(bobBalanceStep2).to.be.equal(bobBalanceStep1.add(70))

    const jobDataStep2 = await jobRegistry.getJob(12)
    expect(jobDataStep2.status.toString()).to.be.equal("2")

    // What an amazing job, let's review each others
    await talentLayerReview.connect(alice).addReview(12, "cidReview3", 5);
    await talentLayerReview.connect(bob).addReview(12, "cidReview4", 5);

    expect(await talentLayerReview.reviewDataUri(2)).to.be.equal("cidReview3");
    expect(await talentLayerReview.reviewDataUri(3)).to.be.equal("cidReview4");
  });
});
