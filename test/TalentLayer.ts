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
        jobRegistry: Contract,
        talentLayerID: Contract,
        talentLayerReview: Contract

    before(async function () {
        [deployer, alice, bob, carol, dave] = await ethers.getSigners()

        // Deploy TalenLayerID
        TalentLayerID = await ethers.getContractFactory('TalentLayerID')
        const talentLayerIDArgs:[string, string] = [
            'ipfs://CID/',
            '0xa3ebdcaecb63baab11084e4B73B5fAa0d8e14Ac9'
        ]
        talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)

        // Create Id for our three users, not for dave
        await talentLayerID.connect(alice).mint("alice");
        await talentLayerID.connect(bob).mint("bob");
        await talentLayerID.connect(carol).mint("carol");

        // Deploy JobRegistry
        JobRegistry = await ethers.getContractFactory("JobRegistry")
        jobRegistry = await JobRegistry.deploy(talentLayerID.address)

        // Deploy TalentLayerReview
        TalentLayerReview = await ethers.getContractFactory("TalentLayerReview")
        talentLayerReview = await TalentLayerReview.deploy("TalentLayer Review", "TLR", talentLayerID.address, jobRegistry.address)
    })

    it("Alice, the employer, can initiate a new job with Bob, the employee", async function () {
        const bobTid = await talentLayerID.walletOfOwner(bob.address)
        await jobRegistry.connect(alice).createJobFromEmployer(bobTid, 'cid')
        const jobData = await jobRegistry.jobs(1)

        expect(jobData.status.toString()).to.be.equal('0')
        expect(jobData.employerId.toString()).to.be.equal('1')
        expect(jobData.initiatorId.toString()).to.be.equal('1')
        expect(jobData.employeeId.toString()).to.be.equal('2')
        expect(jobData.jobDataUri).to.be.equal('cid')
    });

    it("Bob, the employee, can confrim the job, Alice can't, Carol can't", async function () {
        expect(jobRegistry.connect(alice).confirmJob(1)).to.be.revertedWith("Only the user who didn't initate the job can confirm it")
        expect(jobRegistry.connect(carol).confirmJob(1)).to.be.revertedWith("You're not an actor of this job")
        await jobRegistry.connect(bob).confirmJob(1)
        const jobData = await jobRegistry.jobs(1)
        expect(jobData.status.toString()).to.be.equal('1')
        expect(jobRegistry.connect(bob).confirmJob(1)).to.be.revertedWith("Job has already been confirmed")
    });

    it("Bob can't write a review yet", async function () {
        expect(talentLayerReview.connect(bob).addReview(1, 0, 'cidReview')).to.be.revertedWith("The job is not finished yet")
    });

    it("Carol can't write a review as she's not linked to this job", async function () {
        expect(talentLayerReview.connect(carol).addReview(1, 0, 'cidReview')).to.be.revertedWith("You're not an actor of this job")
    });

    it("Alice can say that the job is finished", async function () {
        await jobRegistry.connect(alice).finishJob(1)
        const jobData = await jobRegistry.jobs(1)
        expect(jobData.status.toString()).to.be.equal('2')
    });

    it("Alice and Bob can write a review now and we can get review data", async function () {
        await talentLayerReview.connect(alice).addReview(1, 0, 'cidReview1')
        await talentLayerReview.connect(bob).addReview(1, 1, 'cidReview2')

        expect(await talentLayerReview.reviewDataUri(0)).to.be.equal('cidReview1')
        expect(await talentLayerReview.reviewDataUri(1)).to.be.equal('cidReview2')
    });

    it("Alice and Bob can't write a review for the same Job", async function () {
        expect(talentLayerReview.connect(alice).addReview(1, 0, 'cidReview')).to.be.revertedWith('ReviewAlreadyMinted()')
        expect(talentLayerReview.connect(bob).addReview(1, 1, 'cidReview')).to.be.revertedWith('ReviewAlreadyMinted()')
    });

    it("Carol, a new employer, can initiate a new job with Bob, the employee", async function () {
        const bobTid = await talentLayerID.walletOfOwner(bob.address)
        await jobRegistry.connect(carol).createJobFromEmployer(bobTid, 'cid2')
        const jobData = await jobRegistry.jobs(2)

        expect(jobData.status.toString()).to.be.equal('0')
        expect(jobData.employerId.toString()).to.be.equal('3')
        expect(jobData.initiatorId.toString()).to.be.equal('3')
        expect(jobData.employeeId.toString()).to.be.equal('2')
        expect(jobData.jobDataUri).to.be.equal('cid2')
    });

    it("Bob can reject Carol new job as he's not agree with the job details", async function () {
        await jobRegistry.connect(bob).rejectJob(2)
        const jobData = await jobRegistry.jobs(2)
        expect(jobData.status.toString()).to.be.equal('3')
        expect(jobRegistry.connect(bob).confirmJob(1)).to.be.revertedWith("You can't finish this job")
    });

    it("Bob can post another job with fixed job details, and Carol confirmed it", async function () {
        const carolId = await talentLayerID.walletOfOwner(carol.address)
        await jobRegistry.connect(bob).createJobFromEmployee(carolId, 'cid3')
        let jobData = await jobRegistry.jobs(3)

        expect(jobData.status.toString()).to.be.equal('0')
        expect(jobData.employerId.toString()).to.be.equal('3')
        expect(jobData.initiatorId.toString()).to.be.equal('2')
        expect(jobData.employeeId.toString()).to.be.equal('2')
        expect(jobData.jobDataUri).to.be.equal('cid3')

        await jobRegistry.connect(carol).confirmJob(3)
        jobData = await jobRegistry.jobs(3)

        expect(jobData.status.toString()).to.be.equal('1')
    });

    it("Dave, who doesn't have TalentLayerID, can't create a job", async function () {
        const bobTid = await talentLayerID.walletOfOwner(bob.address)
        expect(jobRegistry.connect(dave).createJobFromEmployer(bobTid, 'cid')).to.be.revertedWith("You sould have a TalentLayerId")
    });
});
