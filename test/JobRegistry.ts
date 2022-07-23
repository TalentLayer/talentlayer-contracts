import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { Contract, ContractFactory } from "ethers";

describe("JobRegistry", function () {
    let deployer: SignerWithAddress,
        alice: SignerWithAddress,
        bob: SignerWithAddress,
        carol: SignerWithAddress,
        dave: SignerWithAddress,
        JobRegistry: ContractFactory,
        TalentLayerID: ContractFactory,
        jobRegistry: Contract,
        talentLayerID: Contract

    before(async function () {
        [deployer, alice, bob, carol, dave] = await ethers.getSigners()

        // Deploy TalenLayerID
        TalentLayerID = await ethers.getContractFactory('TalentLayerID')
        const talentLayerIDArgs:[string, string] = [
            'ipfs://CID/',
            '0xa3ebdcaecb63baab11084e4B73B5fAa0d8e14Ac9'
        ]
        talentLayerID = await TalentLayerID.deploy(...talentLayerIDArgs)

        // Create Id for our three users 
        await talentLayerID.connect(alice).mint("alice");
        await talentLayerID.connect(bob).mint("bob");
        await talentLayerID.connect(carol).mint("carol");

        // Prepare JobRegistry
        JobRegistry = await ethers.getContractFactory("JobRegistry")
        jobRegistry = await JobRegistry.deploy(talentLayerID.address)
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

    it("Alice can say that the job is finished", async function () {
        await jobRegistry.connect(alice).finishJob(1)
        const jobData = await jobRegistry.jobs(1)
        expect(jobData.status.toString()).to.be.equal('2')
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

    it("Dave, who don't have TalentLayerID, can't create a job", async function () {
        const bobTid = await talentLayerID.walletOfOwner(bob.address)
        expect(jobRegistry.connect(dave).createJobFromEmployer(bobTid, 'cid')).to.be.revertedWith("You sould have a TalentLayerId")
    });
});
