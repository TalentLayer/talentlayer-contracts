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
    TalentLayerPlatformID: ContractFactory,
    TalentLayerReview: ContractFactory,
    TalentLayerMultipleArbitrableTransaction: ContractFactory,
    TalentLayerArbitrator: ContractFactory,
    MockProofOfHumanity: ContractFactory,
    SimpleERC20: ContractFactory,
    jobRegistry: Contract,
    talentLayerID: Contract,
    talentLayerPlatformID: Contract,
    talentLayerReview: Contract,
    talentLayerMultipleArbitrableTransaction: Contract,
    talentLayerArbitrator: Contract,
    mockProofOfHumanity: Contract,
    token: Contract,
    platformName: string,
    platformId: string;

  before(async function () {
    [deployer, alice, bob, carol, dave] = await ethers.getSigners();

    // Deploy MockProofOfHumanity
    MockProofOfHumanity = await ethers.getContractFactory(
      "MockProofOfHumanity"
    );
    mockProofOfHumanity = await MockProofOfHumanity.deploy();
    mockProofOfHumanity.addSubmissionManually([alice.address, bob.address]);

    // Deploy PlatformId
    TalentLayerPlatformID = await ethers.getContractFactory(
      "TalentLayerPlatformID"
    );
    talentLayerPlatformID = await TalentLayerPlatformID.deploy();

    // Deploy TalenLayerID
    TalentLayerID = await ethers.getContractFactory("TalentLayerID");
    const talentLayerIDArgs: [string, string] = [
      mockProofOfHumanity.address,
      talentLayerPlatformID.address,
    ];
    talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs);

    // Deploy JobRegistry
    JobRegistry = await ethers.getContractFactory("JobRegistry");
    const jobRegistryArgs: [string, string] = [
      talentLayerID.address,
      talentLayerPlatformID.address,
    ];
    jobRegistry = await JobRegistry.deploy(...jobRegistryArgs);

    // Deploy TalentLayerReview
    TalentLayerReview = await ethers.getContractFactory("TalentLayerReview");
    const talentLayerReviewArgs: [string, string, string, string, string] = [
      "TalentLayer Review",
      "TLR",
      talentLayerID.address,
      jobRegistry.address,
      talentLayerPlatformID.address,
    ];
    talentLayerReview = await TalentLayerReview.deploy(...talentLayerReviewArgs);

    // Deploy TalentLayerArbitrator
    TalentLayerArbitrator = await ethers.getContractFactory(
      "TalentLayerArbitrator"
    );
    talentLayerArbitrator = await TalentLayerArbitrator.deploy(0);

    // Deploy TalentLayerMultipleArbitrableTransaction
    TalentLayerMultipleArbitrableTransaction = await ethers.getContractFactory(
      "TalentLayerMultipleArbitrableTransaction"
    );
    talentLayerMultipleArbitrableTransaction =
      await TalentLayerMultipleArbitrableTransaction.deploy(
        jobRegistry.address,
        talentLayerID.address,
        talentLayerArbitrator.address,
        [],
        3600 * 24 * 30
      );

    // Deploy SimpleERC20 Token
    SimpleERC20 = await ethers.getContractFactory("SimpleERC20");
    token = await SimpleERC20.deploy();

    // Grant escrow role
    const escrowRole = await jobRegistry.ESCROW_ROLE();
    await jobRegistry.grantRole(
      escrowRole,
      talentLayerMultipleArbitrableTransaction.address
    );

    // Grant Platform Id Mint role to Alice
    const mintRole = await talentLayerPlatformID.MINT_ROLE();
    await talentLayerPlatformID.connect(deployer).grantRole(
      mintRole,
      alice.address);

    // Alice mints a Platform Id
    platformName ='HireVibes';
    await talentLayerPlatformID.connect(alice).mint(platformName);
  });

  describe("Platform Id contract test", async function () {
  it("Alice successfully minted a PlatformId Id", async function () {
    platformId = await talentLayerPlatformID.getPlatformIdFromAddress(alice.address);
    expect(platformId).to.be.equal("1");
    });

    it("Alice can check the number of id minted", async function () {
      await talentLayerPlatformID.connect(alice).numberMinted(alice.address);
      expect(
        await talentLayerPlatformID.numberMinted(alice.address)
      ).to.be.equal("1");
    });

    it("Alice can update the platform Data", async function () {
      await talentLayerPlatformID
        .connect(alice)
        .updateProfileData("1", "newPlatId");
      expect(await talentLayerPlatformID.platformUri("1")).to.be.equal(
        "newPlatId"
      );
    });

    it("Alice should not be able to transfer her PlatformId Id to Bob", async function () {
      expect(
        talentLayerPlatformID.transferFrom(alice.address, bob.address, 1)
      ).to.be.revertedWith("Not allowed");
    });

    it("Alice should not be able to mint a new PlatformId ID", async function () {
      expect(
        talentLayerPlatformID.connect(alice).mint("SecPlatId")
      ).to.be.revertedWith("You already have a Platform ID");
    });

    it("Alice should not be able to mint a PlatformId ID with the same name", async function () {
      expect(
        talentLayerPlatformID.connect(alice).mint("PlatId")
      ).to.be.revertedWith("You already have a Platform ID");
    });

    it("Alice's PlatformID ownership data is coherent", async function () {
      const name = await talentLayerPlatformID.names(platformId);
      const isNameTaken = await talentLayerPlatformID.takenNames(platformName);
      const idOwner = await talentLayerPlatformID.ownerOf(platformId);
      expect(platformName).to.equal(name);
      expect(isNameTaken).to.equal(true);
      expect(platformName).to.equal(platformName);
      expect(idOwner).to.equal(alice.address);
    });
  });

  it("Alice, Bob and Carol can mint a talentLayerId", async function () {
    await talentLayerID.connect(alice).mintWithPoh("1", "alice");
    await talentLayerID.connect(bob).mintWithPoh("1", "bob");

    expect(
      talentLayerID.connect(carol).mintWithPoh("1", "carol")
    ).to.be.revertedWith(
      "You need to use an address registered on Proof of Humanity"
    );
    await talentLayerID.connect(carol).mint("1", "carol");
    expect(await talentLayerID.walletOfOwner(alice.address)).to.be.equal("1");
    expect(await talentLayerID.walletOfOwner(bob.address)).to.be.equal("2");
    expect(await talentLayerID.walletOfOwner(carol.address)).to.be.equal("3");
    const carolUserId = await talentLayerID.walletOfOwner(carol.address);
    const profileData = await talentLayerID.profiles(carolUserId);
    expect(profileData.platformId).to.be.equal(
      "1"
    );
  });

  it("Carol can activate POH on her talentLayerID", async function () {
    expect(
      talentLayerID.connect(carol).mintWithPoh(1, "carol")
    ).to.be.revertedWith("You're address is not registerd for poh");
    await mockProofOfHumanity.addSubmissionManually([carol.address]);
    await talentLayerID.connect(carol).activatePoh(3);
    const profileData = await talentLayerID.profiles(3);

    expect(await talentLayerID.isTokenPohRegistered(3)).to.be.equal(true);
    expect(await profileData.pohAddress).to.be.equal(carol.address);
  });

  it("Alice, the employer, can initiate a new job with Bob, the employee", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).createJobFromEmployer(1, bobTid, "cid");
    const jobData = await jobRegistry.jobs(1);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employerId.toString()).to.be.equal("1");
    expect(jobData.initiatorId.toString()).to.be.equal("1");
    expect(jobData.employeeId.toString()).to.be.equal("2");
    expect(jobData.jobDataUri).to.be.equal("cid");
    expect(jobData.platformId).to.be.equal(1);
  });

  it("Alice can't create a new job with a talentLayerId 0", async function () {
    expect(
      jobRegistry.connect(alice).createJobFromEmployer(0, "cid", 1)
    ).to.be.revertedWith("Employee 0 is not a valid TalentLayerId");
    expect(
      jobRegistry.connect(alice).createJobFromEmployee(0, "cid", 1)
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
      talentLayerReview.connect(bob).addReview(1, "cidReview", 3, 1)
    ).to.be.revertedWith("The job is not finished yet");
  });

  it("Carol can't write a review as she's not linked to this job", async function () {
    expect(
      talentLayerReview.connect(carol).addReview(1, "cidReview", 5, 1)
    ).to.be.revertedWith("You're not an actor of this job");
  });

  it("Alice can say that the job is finished", async function () {
    await jobRegistry.connect(alice).finishJob(1);
    const jobData = await jobRegistry.jobs(1);
    expect(jobData.status.toString()).to.be.equal("2");
  });

  it("Alice and Bob can write a review now and we can get review data", async function () {
    await talentLayerReview.connect(alice).addReview(1, "cidReview1", 2, 1);
    await talentLayerReview.connect(bob).addReview(1, "cidReview2", 4, 1);

    expect(await talentLayerReview.reviewDataUri(0)).to.be.equal("cidReview1");
    expect(await talentLayerReview.reviewDataUri(1)).to.be.equal("cidReview2");
    expect(await talentLayerReview.reviewIdToPlatformId(1)).to.be.equal(1);
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
    await jobRegistry.connect(carol).createJobFromEmployer(1, bobTid, "cid2");
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
    await jobRegistry.connect(bob).createJobFromEmployee(1, carolId, "cid3");
    let jobData = await jobRegistry.jobs(3);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employerId.toString()).to.be.equal("3");
    expect(jobData.initiatorId.toString()).to.be.equal("2");
    expect(jobData.employeeId.toString()).to.be.equal("2");
    expect(jobData.jobDataUri).to.be.equal("cid3");
    expect(jobData.platformId).to.be.equal(1);

    await jobRegistry.connect(carol).confirmJob(3);
    jobData = await jobRegistry.jobs(3);

    expect(jobData.status.toString()).to.be.equal("1");
  });

  it("Dave, who doesn't have TalentLayerID, can't create a job", async function () {
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    expect(
      jobRegistry.connect(dave).createJobFromEmployer(1, bobTid, "cid")
    ).to.be.revertedWith("You sould have a TalentLayerId");
  });

  it("Alice the employer can create an Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
    const jobData = await jobRegistry.jobs(4);

    expect(jobData.status.toString()).to.be.equal("4");
    expect(jobData.employerId.toString()).to.be.equal("1");
    expect(jobData.initiatorId.toString()).to.be.equal("1");
    expect(jobData.employeeId.toString()).to.be.equal("0");
    expect(jobData.jobDataUri).to.be.equal("cid");
    expect(jobData.platformId).to.be.equal(1);
  });

  it("Alice can assign an employee to a Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).assignEmployeeToJob(5, bobTid);
    const jobData = await jobRegistry.jobs(5);

    expect(jobData.status.toString()).to.be.equal("0");
    expect(jobData.employeeId.toString()).to.be.equal(bobTid);
  });

  it("Bob can confirm the Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
    const bobTid = await talentLayerID.walletOfOwner(bob.address);
    await jobRegistry.connect(alice).assignEmployeeToJob(6, bobTid);
    await jobRegistry.connect(bob).confirmJob(6);
    const jobData = await jobRegistry.jobs(6);

    expect(jobData.status.toString()).to.be.equal("1");
  });

  it("Bob can reject an Open job", async function () {
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
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
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");

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
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
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
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
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
    await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
    await jobRegistry.connect(bob).createProposal(11, rateToken, 1, "cid");

    await jobRegistry.connect(alice).rejectProposal(11, bobTid);

    const proposalDataAfter = await jobRegistry.getProposal(11, bobTid);
    expect(proposalDataAfter.status.toString()).to.be.equal("2");
  });

  describe("SimpleERC20 contract.", function () {
    describe("Deployment", function () {
      // it("Should be accessible", async function () {
      //   await loadFixture(deployTokenFixture);
      //   expect(await token.ping()).to.equal(1);
      // });

      it("Should set the right deployer", async function () {
        expect(await token.owner()).to.equal(deployer.address);
      });

      it("Should assign the total supply of tokens to the deployer", async function () {
        // await loadFixture(deployTokenFixture);
        const deployerBalance = await token.balanceOf(deployer.address);
        const totalSupply = await token.totalSupply();
        expect(totalSupply).to.equal(deployerBalance);
      });

      it("Should transfer 1000 tokens to alice", async function () {
        // await loadFixture(deployTokenFixture);
        expect(token.transfer(alice.address, 1000)).to.changeTokenBalances(
          token,
          [deployer, alice],
          [-1000, 1000]
        );
      });
    });

    describe("Token transactions.", function () {
      it("Should transfer tokens between accounts", async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        expect(token.transfer(alice.address, 50)).to.changeTokenBalances(
          token,
          [deployer, alice],
          [-50, 50]
        );

        // Transfer 50 tokens from alice to bob
        expect(
          token.connect(alice).transfer(bob.address, 50)
        ).to.changeTokenBalances(token, [alice, bob], [-50, 50]);
      });

      it("Should emit Transfer events.", async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        expect(token.transfer(alice.address, 50))
          .to.emit(token, "Transfer")
          .withArgs(deployer.address, alice.address, 50);

        // Transfer 50 tokens from alice to bob
        expect(token.connect(alice).transfer(bob.address, 50))
          .to.emit(token, "Transfer")
          .withArgs(alice.address, bob.address, 50);
      });

      it("Should revert when sender doesn't have enough tokens.", async function () {
        // await loadFixture(deployTokenFixture);

        const initialdeployerBalance = await token.balanceOf(deployer.address);

        // Try to send 1 token from dave (0 tokens) to deployer (1000 tokens).
        expect(
          token.connect(dave).transfer(deployer.address, 1)
        ).to.be.revertedWith("ERC20: transfer amount exceeds balance");

        // deployer balance shouldn't have changed.
        expect(await token.balanceOf(deployer.address)).to.equal(
          initialdeployerBalance
        );
      });
    });
  });

  describe("Escrow Contract.", function () {
    describe("Successful use of Escrow for a job using an ERC20 token.", function () {
      const amountBob = 100;
      const amountCarol = 200;
      const jobId = 12;
      const adminFeeAmount = 0;
      const transactionId = 0;
      let proposalIdBob = 0; //Will be set later
      let proposalIdCarol = 0; //Will be set later

      it("Alice can create a job.", async function () {
        await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
      });

      it("Alice can NOT deposit tokens to escrow yet.", async function () {
        await token
          .connect(alice)
          .approve(talentLayerMultipleArbitrableTransaction.address, amountBob);
        expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createTokenTransaction(
              3600 * 24 * 7,
              "_metaEvidence",
              dave.address,
              adminFeeAmount,
              jobId,
              proposalIdBob
            )
        ).to.be.reverted;
      });

      it("Bob can register a proposal.", async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address);
        await jobRegistry
          .connect(bob)
          .createProposal(jobId, token.address, amountBob, "cid");
      });

      it("Carol can register a proposal.", async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address);
        await jobRegistry
          .connect(carol)
          .createProposal(jobId, token.address, amountCarol, "cid");
      });

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        await token
          .connect(alice)
          .approve(talentLayerMultipleArbitrableTransaction.address, amountBob);
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .createTokenTransaction(
            3600 * 24 * 7,
            "_metaEvidence",
            dave.address,
            adminFeeAmount,
            jobId,
            proposalIdBob
          );
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [amountBob, -amountBob, 0]
        );

        await expect(transaction)
          .to.emit(
            talentLayerMultipleArbitrableTransaction,
            "JobProposalConfirmedWithDeposit"
          )
          .withArgs(jobId, proposalIdBob, transactionId);
      });

      it("The deposit should also validate the proposal.", async function () {
        const proposal = await jobRegistry.getProposal(jobId, proposalIdBob);
        await expect(proposal.status.toString()).to.be.equal("1");
      });

      it("The deposit should also update the job with transactionId, proposalId, and status.", async function () {
        const job = await jobRegistry.getJob(jobId);
        await expect(job.status.toString()).to.be.equal("1");
        await expect(job.transactionId.toString()).to.be.equal("0");
        await expect(job.employeeId.toString()).to.be.equal(proposalIdBob);
      });

      it("Alice can NOT deposit funds for Carol's proposal.", async function () {
        await token
          .connect(alice)
          .approve(
            talentLayerMultipleArbitrableTransaction.address,
            amountCarol
          );
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createTokenTransaction(
              3600 * 24 * 7,
              "_metaEvidence",
              dave.address,
              adminFeeAmount,
              jobId,
              proposalIdCarol
            )
        ).to.be.reverted;
      });

      it("Carol should not be allowed to release escrow the job.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(carol)
            .release(transactionId, 10)
        ).to.be.revertedWith("Access denied.");
      });

      it("Alice can release half of the escrow to bob.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 2);
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2]
        );
      });

      it("Alice can release a quarter of the escrow to Bob.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 4);
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4]
        );
      });

      it("Carol can NOT reimburse alice.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(carol)
            .reimburse(transactionId, amountBob / 4)
        ).to.revertedWith("Access denied.");
      });

      it("Bob can NOT reimburse alice for more than what is left in escrow.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(bob)
            .reimburse(transactionId, amountBob)
        ).to.revertedWith("Insufficient funds.");
      });

      it("Bob can reimburse alice for what is left in the escrow, an emit will be sent.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(bob)
          .reimburse(transactionId, amountBob / 4);
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, amountBob / 4, 0]
        );
        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, "PaymentCompleted")
          .withArgs(jobId);
      });

      it("Alice can not release escrow because there is none left. ", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .release(transactionId, 1)
        ).to.be.revertedWith("Insufficient funds.");
      });
    });

    describe("Successful use of Escrow for a job using ETH.", function () {
      const amountBob = 100;
      const amountCarol = 200;
      const jobId = 13;
      const adminFeeAmount = 0;
      const transactionId = 1;
      let proposalIdBob = 0; //Will be set later
      let proposalIdCarol = 0; //Will be set later
      const ethAddress = "0x0000000000000000000000000000000000000000";

      it("Alice can create a job.", async function () {
        await jobRegistry.connect(alice).createOpenJobFromEmployer(1, "cid");
      });

      it("Alice can NOT deposit eth to escrow yet.", async function () {
        await token
          .connect(alice)
          .approve(talentLayerMultipleArbitrableTransaction.address, amountBob);
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createETHTransaction(
              3600 * 24 * 7,
              "_metaEvidence",
              dave.address,
              adminFeeAmount,
              jobId,
              proposalIdBob
            )
        ).to.be.reverted;
      });

      it("Bob can register a proposal.", async function () {
        proposalIdBob = await talentLayerID.walletOfOwner(bob.address);
        await jobRegistry
          .connect(bob)
          .createProposal(jobId, ethAddress, amountBob, "cid");
      });

      it("Carol can register a proposal.", async function () {
        proposalIdCarol = await talentLayerID.walletOfOwner(carol.address);
        await jobRegistry
          .connect(carol)
          .createProposal(jobId, ethAddress, amountCarol, "cid");
      });

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .createETHTransaction(
            3600 * 24 * 7,
            "_metaEvidence",
            dave.address,
            adminFeeAmount,
            jobId,
            proposalIdBob,
            { value: amountBob }
          );
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [amountBob, -amountBob, 0]
        );

        await expect(transaction)
          .to.emit(
            talentLayerMultipleArbitrableTransaction,
            "JobProposalConfirmedWithDeposit"
          )
          .withArgs(jobId, proposalIdBob, transactionId);
      });

      it("The deposit should also validate the proposal.", async function () {
        const proposal = await jobRegistry.getProposal(jobId, proposalIdBob);
        await expect(proposal.status.toString()).to.be.equal("1");
      });

      it("The deposit should also update the job with transactionId, proposalId, and status.", async function () {
        const job = await jobRegistry.getJob(jobId);
        await expect(job.status.toString()).to.be.equal("1");
        await expect(job.transactionId).to.be.equal(transactionId);
        await expect(job.employeeId).to.be.equal(proposalIdBob);
      });

      it("Alice can NOT deposit funds for Carol's proposal, and NO event should emit.", async function () {
        await token
          .connect(alice)
          .approve(
            talentLayerMultipleArbitrableTransaction.address,
            amountCarol
          );
        expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .createETHTransaction(
              3600 * 24 * 7,
              "_metaEvidence",
              dave.address,
              adminFeeAmount,
              jobId,
              proposalIdCarol,
              { value: amountCarol }
            )
        ).to.be.reverted;
      });

      it("Carol should not be allowed to release escrow the job.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(carol)
            .release(transactionId, 10)
        ).to.be.revertedWith("Access denied.");
      });

      it("Alice can release half of the escrow to bob.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 2);
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2]
        );
      });

      it("Alice can release a quarter of the escrow to Bob.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(alice)
          .release(transactionId, amountBob / 4);
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4]
        );
      });

      it("Carol can NOT reimburse alice.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(carol)
            .reimburse(transactionId, amountBob / 4)
        ).to.revertedWith("Access denied.");
      });

      it("Bob can NOT reimburse alice for more than what is left in escrow.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(bob)
            .reimburse(transactionId, amountBob)
        ).to.revertedWith("Insufficient funds.");
      });

      it("Bob can reimburse alice for what is left in the escrow, an emit will be sent.", async function () {
        const transaction = await talentLayerMultipleArbitrableTransaction
          .connect(bob)
          .reimburse(transactionId, amountBob / 4);
        await expect(transaction).to.changeEtherBalances(
          [talentLayerMultipleArbitrableTransaction.address, alice, bob],
          [-amountBob / 4, amountBob / 4, 0]
        );
        await expect(transaction)
          .to.emit(talentLayerMultipleArbitrableTransaction, "PaymentCompleted")
          .withArgs(jobId);
      });

      it("Alice can not release escrow because there is none left.", async function () {
        await expect(
          talentLayerMultipleArbitrableTransaction
            .connect(alice)
            .release(transactionId, 10)
        ).to.be.revertedWith("Insufficient funds.");
      });
    });
  });
});
