import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'
import { getConfig, Network, NetworkConfig } from '../../networkConfig'
import { deploy } from '../utils/deploy'
import {
  TalentLayerService,
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerID,
  TalentLayerPlatformID,
  TalentLayerReview,
} from '../../typechain-types'

const aliceTlId = 1
const bobTlId = 2
const carolTlId = 3

const alicePlatformId = 1
const bobPlatformId = 2

const now = Math.floor(Date.now() / 1000)
const proposalExpirationDate = now + 60 * 60 * 24 * 15

describe('TalentLayer protocol global testing', function () {
  // we define the types of the variables we will use
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    eve: SignerWithAddress,
    frank: SignerWithAddress,
    grace: SignerWithAddress,
    heidi: SignerWithAddress,
    talentLayerService: TalentLayerService,
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerReview: TalentLayerReview,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    token: SimpleERC20,
    platformName: string,
    platformId: string,
    mintFee: number,
    networkConfig: NetworkConfig,
    chainId: number

  const nonListedRateToken = '0x6b175474e89094c44da98b954eedeac495271d0f'

  before(async function () {
    // Get the Signers
    ;[deployer, alice, bob, carol, dave, eve, frank, grace, heidi] = await ethers.getSigners()
    ;[
      talentLayerID,
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerArbitrator,
      talentLayerService,
      talentLayerReview,
      token,
    ] = await deploy(true)

    // Grant Platform Id Mint role to Deployer and Bob
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, deployer.address)
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, bob.address)
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, eve.address)
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, grace.address)

    // we first check the actual minting status (should be ONLY_WHITELIST )
    const mintingStatus = await talentLayerPlatformID.connect(deployer).mintStatus()
    expect(mintingStatus).to.be.equal(1)
    // then we whitelist the deployer and Alice to mint a PlatformId for someone
    await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
    await talentLayerPlatformID.connect(deployer).whitelistUser(alice.address)
    await talentLayerPlatformID.connect(deployer).whitelistUser(bob.address)
    await talentLayerPlatformID.connect(deployer).whitelistUser(carol.address)
    await talentLayerPlatformID.connect(deployer).whitelistUser(grace.address)
    await talentLayerPlatformID.connect(deployer).whitelistUser(eve.address)
    // we check if the deployer is well whitelisted
    const deployerWhitelisted = await talentLayerPlatformID.whitelist(deployer.address)
    expect(deployerWhitelisted).to.be.equal(true)

    // Deployer mints Platform Id for Alice
    platformName = 'hirevibes'
    await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, alice.address)
    mintFee = 100

    const allowedTokenList = [
      '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10',
      '0x0000000000000000000000000000000000000000',
      '0x07865c6e87b9f70255377e024ace6630c1eaa37f',
      '0x73967c6a0904aa032c103b4104747e88c566b1a2',
      '0xd80d331d3b6dca0a20f4af2edc9c9645cd1f10c8',
      token.address,
    ]

    // Deployer whitelists a list of authorized tokens
    for (const tokenAddress of allowedTokenList) {
      await talentLayerService.connect(deployer).updateAllowedTokenList(tokenAddress, true)
    }
  })

  describe('Platform Id contract test', async function () {
    it('Alice owns a PlatformId Id minted by the deployer', async function () {
      platformId = (await talentLayerPlatformID.ids(alice.address)).toString()
      expect(platformId).to.be.equal('1')
    })

    it('Alice can check the number of id minted', async function () {
      await talentLayerPlatformID.connect(alice).numberMinted(alice.address)
      expect(await talentLayerPlatformID.numberMinted(alice.address)).to.be.equal('1')
    })

    it('Alice can update the platform Data', async function () {
      await talentLayerPlatformID.connect(alice).updateProfileData(aliceTlId, 'newPlatId')

      const aliceUserId = await talentLayerPlatformID.ids(alice.address)
      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      expect(alicePlatformData.dataUri).to.be.equal('newPlatId')
    })

    it('Alice should not be able to transfer her PlatformId Id to Bob', async function () {
      await expect(
        talentLayerPlatformID.transferFrom(alice.address, bob.address, 1),
      ).to.be.revertedWith('Not allowed')
    })

    it('Alice should not be able to mint a new PlatformId ID', async function () {
      await expect(talentLayerPlatformID.connect(alice).mint('SecPlatId')).to.be.revertedWith(
        'Platform already has a Platform ID',
      )
    })

    it("ALice can't mint a platformId for someone else", async function () {
      const mintRole = await talentLayerPlatformID.MINT_ROLE()
      await expect(
        talentLayerPlatformID.connect(alice).mintForAddress('platid2', dave.address),
      ).to.be.revertedWith(
        `AccessControl: account ${alice.address.toLowerCase()} is missing role ${mintRole.toLowerCase()}`,
      )
    })

    it('Alice should not be able to mint a PlatformId ID with the same name', async function () {
      await expect(talentLayerPlatformID.connect(alice).mint('PlatId')).to.be.revertedWith(
        'Platform already has a Platform ID',
      )
    })

    it("Alice's PlatformID ownership data is coherent", async function () {
      const aliceUserId = await talentLayerPlatformID.ids(alice.address)
      const alicePlatformData = await talentLayerPlatformID.platforms(aliceUserId)
      const name = alicePlatformData.name
      const isNameTaken = await talentLayerPlatformID.takenNames(platformName)
      const idOwner = await talentLayerPlatformID.ownerOf(platformId)
      expect(platformName).to.equal(name)
      expect(isNameTaken).to.equal(true)
      expect(platformName).to.equal(platformName)
      expect(idOwner).to.equal(alice.address)
    })

    it('Alice should be able to set up and update platform fees', async function () {
      const adminRole = await talentLayerPlatformID.DEFAULT_ADMIN_ROLE()

      await talentLayerPlatformID.grantRole(adminRole, alice.address)
      await talentLayerPlatformID.connect(alice).updateOriginServiceFeeRate(alicePlatformId, 1)
      await talentLayerPlatformID
        .connect(alice)
        .updateOriginValidatedProposalFeeRate(alicePlatformId, 15)

      const alicePlatformData = await talentLayerPlatformID.platforms(alicePlatformId)

      expect(alicePlatformData.originServiceFeeRate).to.be.equal(1)
      expect(alicePlatformData.originValidatedProposalFeeRate).to.be.equal(15)

      await talentLayerPlatformID.connect(alice).updateOriginServiceFeeRate(alicePlatformId, 6)
      await talentLayerPlatformID
        .connect(alice)
        .updateOriginValidatedProposalFeeRate(alicePlatformId, 10)

      const newAlicePlatformData = await talentLayerPlatformID.platforms(alicePlatformId)

      expect(newAlicePlatformData.originServiceFeeRate).to.be.equal(6)
      expect(newAlicePlatformData.originValidatedProposalFeeRate).to.be.equal(10)
    })

    it('The deployer can update the mint fee', async function () {
      await talentLayerPlatformID.connect(deployer).updateMintFee(mintFee)
      const updatedMintFee = await talentLayerPlatformID.mintFee()

      expect(updatedMintFee).to.be.equal(mintFee)
    })

    it('The deployer can update the minting status to PAUSE and trigger the event', async function () {
      const transcation = await talentLayerPlatformID.connect(deployer).updateMintStatus(0)
      const mintingStatus = await talentLayerPlatformID.connect(deployer).mintStatus()
      expect(mintingStatus).to.be.equal(0)
      await expect(transcation).to.emit(talentLayerPlatformID, 'MintStatusUpdated').withArgs(0)
    })

    it('Bob cannot mint a platform id because the minting status is PAUSE', async function () {
      await expect(
        talentLayerPlatformID.connect(bob).mint('BobPlat', { value: mintFee }),
      ).to.be.revertedWith('Mint status is not valid')
    })

    it('The deployer can update the minting status to PUBLIC', async function () {
      await talentLayerPlatformID.connect(deployer).updateMintStatus(2)
      const mintingStatus = await talentLayerPlatformID.connect(deployer).mintStatus()
      expect(mintingStatus).to.be.equal(2)
    })

    it('Bob can mint a platform id with allowed characters & correct name length by paying the mint fee', async function () {
      const bobBalanceBefore = await bob.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Mint fails if not enough ETH is sent
      await expect(talentLayerPlatformID.connect(bob).mint('bob_plat')).to.be.revertedWith(
        'Incorrect amount of ETH for mint fee',
      )

      // Mint is successful if the correct amount of ETH for mint fee is sent
      await talentLayerPlatformID.connect(bob).mint('bob_plat', { value: mintFee })
      const bobPlatformId = await talentLayerPlatformID.ids(bob.address)
      expect(bobPlatformId).to.be.equal('2')

      // Bob balance is decreased by the mint fee (+ gas fees)
      const bobBalanceAfter = await bob.getBalance()
      expect(bobBalanceAfter).to.be.lte(bobBalanceBefore.sub(mintFee))

      // Platform id contract balance is increased by the mint fee
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerPlatformID.address)
      expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(mintFee))
    })

    it("Grace can't mint a talentLayerId with caps characters", async function () {
      await expect(
        talentLayerPlatformID.connect(grace).mint('TalentLayer', { value: mintFee }),
      ).to.be.revertedWithCustomError(talentLayerPlatformID, 'HandleContainsInvalidCharacters')
    })

    it("Grace can't mint a talentLayer platform Id with restricted characters", async function () {
      await expect(
        talentLayerPlatformID.connect(grace).mint('t@lently€rB@$€', { value: mintFee }),
      ).to.be.revertedWithCustomError(talentLayerPlatformID, 'HandleContainsInvalidCharacters')
    })

    it("Eve can't mint a talentLayer platform Id with handle length = 0", async function () {
      await expect(
        talentLayerPlatformID.connect(eve).mint('', { value: mintFee }),
      ).to.be.revertedWithCustomError(talentLayerPlatformID, 'HandleLengthInvalid')
    })

    it("Grace can't mint a talentLayer platform Id with a handle length > 31 characters", async function () {
      const tooLongHandle = 'grace123456789qsitorhenchdyahe12'
      expect(tooLongHandle.length).to.be.greaterThan(31)
      await expect(
        talentLayerPlatformID.connect(grace).mint(tooLongHandle, { value: mintFee }),
      ).to.be.revertedWithCustomError(talentLayerPlatformID, 'HandleLengthInvalid')
    })

    it('Grace can mint a talentLayer platform Id with allowed characters and handle length', async function () {
      expect(
        await talentLayerPlatformID
          .connect(grace)
          .mint('longerbut_ok_platformbygrace', { value: mintFee }),
      ).not.to.be.revertedWithCustomError(talentLayerPlatformID, 'HandleContainsInvalidCharacters')
    })

    it("The deployer can withdraw the contract's balance", async function () {
      const deployerBalanceBefore = await deployer.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Withdraw fails if the caller is not an admin
      const adminRole = await talentLayerPlatformID.DEFAULT_ADMIN_ROLE()
      await expect(talentLayerPlatformID.connect(bob).withdraw()).to.be.revertedWith(
        `AccessControl: account ${bob.address.toLowerCase()} is missing role ${adminRole.toLowerCase()}`,
      )

      // Withdraw is successful if the caller is the deployer
      const tx = await talentLayerPlatformID.connect(deployer).withdraw()
      const receipt = await tx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      const deployerBalanceAfter = await deployer.getBalance()
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerPlatformID.address)

      // Deployer balance is increased by the contract balance (- gas fees)s
      expect(deployerBalanceAfter).to.be.equal(
        deployerBalanceBefore.add(contractBalanceBefore).sub(gasUsed),
      )

      // Contract balance is 0
      expect(contractBalanceAfter).to.be.equal(0)
    })

    it('The deployer can add a new available arbitrator', async function () {
      await talentLayerPlatformID
        .connect(deployer)
        .addArbitrator(talentLayerArbitrator.address, true)
      const isValid = await talentLayerPlatformID.validArbitrators(talentLayerArbitrator.address)
      expect(isValid).to.be.true

      const isInternal = await talentLayerPlatformID.internalArbitrators(
        talentLayerArbitrator.address,
      )
      expect(isInternal).to.be.true
    })

    it('The platform owner can update the arbitrator only if is a valid one', async function () {
      const tx = talentLayerPlatformID.connect(alice).updateArbitrator(1, dave.address, [])
      await expect(tx).to.be.revertedWith('The address must be of a valid arbitrator')

      await talentLayerPlatformID
        .connect(alice)
        .updateArbitrator(1, talentLayerArbitrator.address, [])
      const arbitrator = (await talentLayerPlatformID.getPlatform(alicePlatformId)).arbitrator
      expect(arbitrator).to.be.equal(talentLayerArbitrator.address)

      // Extra data is updated and is equal to the platform id since the arbitrator is internal
      const arbitratorExtraData = (await talentLayerPlatformID.getPlatform(alicePlatformId))
        .arbitratorExtraData
      const platformId = BigNumber.from(arbitratorExtraData)
      expect(platformId).to.be.equal(1)
    })

    it('The deployer can update the minimum arbitration fee timeout', async function () {
      const minArbitrationFeeTimeout = 3600 * 10
      await talentLayerPlatformID
        .connect(deployer)
        .updateMinArbitrationFeeTimeout(minArbitrationFeeTimeout)
      const updatedMinArbitrationFeeTimeout = await talentLayerPlatformID.minArbitrationFeeTimeout()

      expect(updatedMinArbitrationFeeTimeout).to.be.equal(minArbitrationFeeTimeout)
    })

    it('The platform owner can update the arbitration fee timeout', async function () {
      const minArbitrationFeeTimeout = await talentLayerPlatformID.minArbitrationFeeTimeout()
      const tx = talentLayerPlatformID
        .connect(alice)
        .updateArbitrationFeeTimeout(1, minArbitrationFeeTimeout.sub(1))
      await expect(tx).to.be.revertedWith('The timeout must be greater than the minimum timeout')

      const arbitrationFeeTimeout = minArbitrationFeeTimeout.add(3600 * 2)
      await talentLayerPlatformID
        .connect(alice)
        .updateArbitrationFeeTimeout(1, arbitrationFeeTimeout)
      const updatedArbitrationFeeTimeout = (
        await talentLayerPlatformID.getPlatform(alicePlatformId)
      ).arbitrationFeeTimeout
      expect(updatedArbitrationFeeTimeout).to.be.equal(arbitrationFeeTimeout)
    })

    it('Only the owner of the platform can update its arbitrator', async function () {
      const tx = talentLayerPlatformID
        .connect(bob)
        .updateArbitrator(1, talentLayerArbitrator.address, [])
      await expect(tx).to.be.revertedWith("You're not the owner of this platform")
    })

    it('The deployer can remove an available arbitrator', async function () {
      await talentLayerPlatformID.connect(deployer).removeArbitrator(talentLayerArbitrator.address)
      const isValid = await talentLayerPlatformID.validArbitrators(talentLayerArbitrator.address)
      expect(isValid).to.be.false

      const isInternal = await talentLayerPlatformID.internalArbitrators(
        talentLayerArbitrator.address,
      )
      expect(isInternal).to.be.false
    })
  })

  describe('Talent Layer ID contract test', function () {
    it("Alice can't mint a talentLayerId with caps characters", async function () {
      await expect(talentLayerID.connect(alice).mint('1', 'Alice')).to.be.revertedWithCustomError(
        talentLayerID,
        'HandleContainsInvalidCharacters',
      )
    })
    it("Alice can't mint a talentLayerId with restricted characters", async function () {
      await expect(talentLayerID.connect(alice).mint('1', 'al/ce')).to.be.revertedWithCustomError(
        talentLayerID,
        'HandleContainsInvalidCharacters',
      )
      await expect(talentLayerID.connect(alice).mint('1', 'a***ce')).to.be.revertedWithCustomError(
        talentLayerID,
        'HandleContainsInvalidCharacters',
      )
    })
    it("Alice can't mint a talentLayerId with handle length = 0", async function () {
      await expect(talentLayerID.connect(alice).mint('1', '')).to.be.revertedWithCustomError(
        talentLayerID,
        'HandleLengthInvalid',
      )
    })
    it("Alice can't mint a talentLayerId with a handle length > 31 characters", async function () {
      const tooLongHandle = 'alice123456789qsitorhenchdyahe12'
      expect(tooLongHandle.length).to.be.greaterThan(31)
      await expect(
        talentLayerID.connect(alice).mint('1', tooLongHandle),
      ).to.be.revertedWithCustomError(talentLayerID, 'HandleLengthInvalid')
    })

    it('Alice, Bob and Carol can mint a talentLayerId, including with "-" & "_" characters and correct handle length', async function () {
      expect(
        await talentLayerID.connect(alice).mint('1', 'ali-ce'),
      ).not.to.be.revertedWithCustomError(talentLayerID, 'HandleContainsInvalidCharacters')
      expect(await talentLayerID.connect(bob).mint('1', 'b_ob')).not.to.be.revertedWithCustomError(
        talentLayerID,
        'HandleContainsInvalidCharacters',
      )
      await talentLayerID.connect(carol).mint('1', 'carol')
      expect(await talentLayerID.ids(alice.address)).to.be.equal(aliceTlId)
      expect(await talentLayerID.ids(bob.address)).to.be.equal(bobTlId)
      expect(await talentLayerID.ids(carol.address)).to.be.equal(carolTlId)
      const carolUserId = await talentLayerID.ids(carol.address)
      const profileData = await talentLayerID.profiles(carolUserId)
      expect(profileData.platformId).to.be.equal('1')
    })

    it('The deployer can update the mint fee', async function () {
      await talentLayerID.connect(deployer).updateMintFee(mintFee)
      const updatedMintFee = await talentLayerID.mintFee()

      expect(updatedMintFee).to.be.equal(mintFee)
    })

    it('Eve can mint a talentLayerId by paying the mint fee', async function () {
      const eveBalanceBefore = await eve.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerID.address)

      // Mint fails if not enough ETH is sent
      await expect(talentLayerID.connect(eve).mint('1', 'eve')).to.be.revertedWith(
        'Incorrect amount of ETH for mint fee',
      )

      // Mint is successful if the correct amount of ETH for mint fee is sent
      await talentLayerID.connect(eve).mint('1', 'eve', { value: mintFee })
      expect(await talentLayerID.ids(eve.address)).to.be.equal('4')

      // Eve balance is decreased by the mint fee (+ gas fees)
      const eveBalanceAfter = await eve.getBalance()
      expect(eveBalanceAfter).to.be.lte(eveBalanceBefore.sub(mintFee))

      // TalentLayer id contract balance is increased by the mint fee
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerID.address)
      expect(contractBalanceAfter).to.be.equal(contractBalanceBefore.add(mintFee))
    })

    it("The deployer can withdraw the contract's balance", async function () {
      const deployerBalanceBefore = await deployer.getBalance()
      const contractBalanceBefore = await ethers.provider.getBalance(talentLayerID.address)

      // Withdraw fails if the caller is not the owner
      await expect(talentLayerID.connect(alice).withdraw()).to.be.revertedWith(
        'Ownable: caller is not the owner',
      )

      // Withdraw is successful if the caller is the owner
      const tx = await talentLayerID.connect(deployer).withdraw()
      const receipt = await tx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      const deployerBalanceAfter = await deployer.getBalance()
      const contractBalanceAfter = await ethers.provider.getBalance(talentLayerID.address)

      // Deployer balance is increased by the contract balance (- gas fees)s
      expect(deployerBalanceAfter).to.be.equal(
        deployerBalanceBefore.add(contractBalanceBefore).sub(gasUsed),
      )

      // Contract balance is 0
      expect(contractBalanceAfter).to.be.equal(0)
    })

    it('Deployer can mint TalentLayerID', async function () {
      const deployerBalanceBefore = await deployer.getBalance()
      const graceBalanceBefore = await grace.getBalance()

      const tx = await talentLayerID.freeMint('1', grace.address, 'grace')
      const receipt = await tx.wait()
      const gasUsed = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      const deployerBalanceAfter = await deployer.getBalance()
      const graceBalanceAfter = await grace.getBalance()

      await expect(
        deployerBalanceAfter,
        'Deployer only pays for gas costs when minting',
      ).to.be.equal(deployerBalanceBefore.sub(gasUsed))
      await expect(graceBalanceAfter, 'Address minted for does not pay anything').to.be.equal(
        graceBalanceBefore,
      )
    })

    it('Alice can NOT mint TalentLayerIDs without paying the mint fee', async function () {
      await expect(
        talentLayerID.connect(alice).freeMint('1', heidi.address, 'heidi'),
        'Alice tries to mint talentLayer ID for heidi for free.',
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('SimpleERC20 contract contract test', function () {
    describe('Deployment', function () {
      // it("Should be accessible", async function () {
      //   await loadFixture(deployTokenFixture);
      //   expect(await token.ping()).to.equal(1);
      // });

      it('Should set the right deployer', async function () {
        expect(await token.owner()).to.equal(deployer.address)
      })

      it('Should assign the total supply of tokens to the deployer', async function () {
        // await loadFixture(deployTokenFixture);
        const deployerBalance = await token.balanceOf(deployer.address)
        const totalSupply = await token.totalSupply()
        expect(totalSupply).to.equal(deployerBalance)
      })

      it('Should transfer 10000000 tokens to alice', async function () {
        // await loadFixture(deployTokenFixture);
        expect(token.transfer(alice.address, 10000000)).to.changeTokenBalances(
          token,
          [deployer, alice],
          [-1000, 1000],
        )
      })
    })

    describe('Token transactions.', function () {
      it('Should transfer tokens between accounts', async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        await expect(token.transfer(alice.address, 50)).to.changeTokenBalances(
          token,
          [deployer, alice],
          [-50, 50],
        )

        // Transfer 50 tokens from alice to bob
        await expect(token.connect(alice).transfer(bob.address, 50)).to.changeTokenBalances(
          token,
          [alice, bob],
          [-50, 50],
        )
      })

      it('Should emit Transfer events.', async function () {
        // await loadFixture(deployTokenFixture);

        // Transfer 50 tokens from deployer to alice
        await expect(token.transfer(alice.address, 50))
          .to.emit(token, 'Transfer')
          .withArgs(deployer.address, alice.address, 50)

        // Transfer 50 tokens from alice to bob
        await expect(token.connect(alice).transfer(bob.address, 50))
          .to.emit(token, 'Transfer')
          .withArgs(alice.address, bob.address, 50)
      })

      it("Should revert when sender doesn't have enough tokens.", async function () {
        // await loadFixture(deployTokenFixture);

        const initialDeployerBalance = await token.balanceOf(deployer.address)

        // Try to send 1 token from dave (0 tokens) to deployer (1000 tokens).
        await expect(token.connect(dave).transfer(deployer.address, 1)).to.be.revertedWith(
          'ERC20: transfer amount exceeds balance',
        )

        // deployer balance shouldn't have changed.
        await expect(await token.balanceOf(deployer.address)).to.equal(initialDeployerBalance)
      })
    })
  })

  describe('Service Registry & Proposal contract test', function () {
    it('Should revert if a user tries to whitelist a payment token without being the owner', async function () {
      await expect(
        talentLayerService.connect(alice).updateAllowedTokenList(token.address, true),
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })

    it('Should revert if the Owner tries to blacklist zero address', async function () {
      await expect(
        talentLayerService
          .connect(deployer)
          .updateAllowedTokenList(ethers.constants.AddressZero, false),
      ).to.be.revertedWith("Owner can't remove Ox address")
    })

    it('Should update the token list accordingly if the owner updates it', async function () {
      const randomTokenAddress = '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'

      await talentLayerService.connect(deployer).updateAllowedTokenList(randomTokenAddress, true)
      expect(await talentLayerService.isTokenAllowed(randomTokenAddress)).to.be.true

      await talentLayerService.connect(deployer).updateAllowedTokenList(randomTokenAddress, false)
      expect(await talentLayerService.isTokenAllowed(randomTokenAddress)).to.be.false
    })

    it("Dave, who doesn't have TalentLayerID, can't create a service", async function () {
      await expect(
        talentLayerService.connect(dave).createService(0, 1, 'haveNotTlid'),
      ).to.be.revertedWith('ERC721: invalid token ID')
    })

    it("Alice can't create a new service with a talentLayerId 0", async function () {
      await expect(
        talentLayerService.connect(alice).createService(aliceTlId, 0, 'cid0'),
      ).to.be.revertedWith('Invalid platform ID')
      await expect(
        talentLayerService.connect(alice).createService(aliceTlId, 0, 'cid0'),
      ).to.be.revertedWith('Invalid platform ID')
    })

    it('Alice the buyer can create a few Open service', async function () {
      const platform = await talentLayerPlatformID.getPlatform(alicePlatformId)
      const alicePlatformServicePostingFee = platform.servicePostingFee

      // Alice will create 4 Open services fo the whole unit test process
      await talentLayerService.connect(alice).createService(aliceTlId, alicePlatformId, 'CID1', {
        value: alicePlatformServicePostingFee,
      })
      const serviceData = await talentLayerService.services(1)

      // service 2
      await talentLayerService.connect(alice).createService(aliceTlId, alicePlatformId, 'CID2', {
        value: alicePlatformServicePostingFee,
      })
      await talentLayerService.services(2)

      // service 3
      await talentLayerService.connect(alice).createService(aliceTlId, alicePlatformId, 'CID3', {
        value: alicePlatformServicePostingFee,
      })
      await talentLayerService.services(3)

      // service 4
      await talentLayerService.connect(alice).createService(aliceTlId, alicePlatformId, 'CID4', {
        value: alicePlatformServicePostingFee,
      })
      await talentLayerService.services(4)

      // service 5 (will be cancelled)
      await talentLayerService.connect(alice).createService(aliceTlId, 1, 'CID5')
      await talentLayerService.services(5)

      expect(serviceData.status.toString()).to.be.equal('0')
      expect(serviceData.ownerId).to.be.equal(aliceTlId)
      expect(serviceData.dataUri).to.be.equal('CID1')
      expect(serviceData.platformId).to.be.equal(1)
    })

    it("Alice can't create a new open service with wrong TalentLayer Platform ID", async function () {
      await expect(
        talentLayerService.connect(alice).createService(aliceTlId, 5, 'wrongTlPid'),
      ).to.be.revertedWith('Invalid platform ID')
    })

    it('Alice can update her service data', async function () {
      await talentLayerService
        .connect(alice)
        .updateServiceData(aliceTlId, 1, 'aliceUpdateHerFirstService')
      const serviceData = await talentLayerService.services(1)
      expect(serviceData.dataUri).to.be.equal('aliceUpdateHerFirstService')
    })

    it('Alice can cancel her own service', async function () {
      await talentLayerService.connect(alice).cancelService(aliceTlId, 5)
      const serviceData = await talentLayerService.services(5)
      expect(serviceData.status).to.be.equal(3)
    })

    it('Alice can cancel only a service that is open', async function () {
      expect(talentLayerService.connect(alice).cancelService(aliceTlId, 5)).to.be.revertedWith(
        'Only services with the open status can be cancelled',
      )
    })

    it('After a service has been cancelled, nobody can post a proposal', async function () {
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
      await talentLayerService.getProposal(5, bobTlId)
      expect(
        talentLayerService
          .connect(bob)
          .createProposal(
            bobTlId,
            5,
            rateToken,
            1,
            bobPlatformId,
            'proposalOnCancelledService',
            proposalExpirationDate,
          ),
      ).to.be.revertedWith('Service is not opened')
    })

    it("Bob cannot cancel Alice's service", async function () {
      expect(talentLayerService.connect(bob).cancelService(aliceTlId, 1)).to.be.revertedWith(
        'Only the initiator can cancel the service',
      )
    })

    it('Bob can create his first proposal for an Open service n°1 from Alice', async function () {
      // Proposal on the Open service n 1
      const bobTid = await talentLayerID.ids(bob.address)
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
      const platform = await talentLayerPlatformID.getPlatform(alicePlatformId)
      const alicePlatformProposalPostingFee = platform.servicePostingFee

      // Proposal data check before the proposal
      const proposalDataBefore = await talentLayerService.getProposal(1, bobTid)
      expect(proposalDataBefore.ownerId.toString()).to.be.equal('0')

      // Bob creates a proposal on Platform 1
      await talentLayerService
        .connect(bob)
        .createProposal(
          bobTlId,
          1,
          rateToken,
          1,
          alicePlatformId,
          'proposal1FromBobToAlice1Service',
          proposalExpirationDate,
          {
            value: alicePlatformProposalPostingFee,
          },
        )

      const serviceData = await talentLayerService.services(1)
      const proposalDataAfter = await talentLayerService.getProposal(1, bobTid)

      // Service data check
      expect(serviceData.status.toString()).to.be.equal('0')
      expect(serviceData.ownerId).to.be.equal(aliceTlId)

      // Proposal data check after the proposal

      expect(proposalDataAfter.rateToken).to.be.equal(rateToken)
      expect(proposalDataAfter.rateAmount.toString()).to.be.equal('1')
      expect(proposalDataAfter.dataUri).to.be.equal('proposal1FromBobToAlice1Service')
      expect(proposalDataAfter.ownerId).to.be.equal(bobTlId)
      expect(proposalDataAfter.status.toString()).to.be.equal('0')
    })

    it('Carol can create her first proposal', async function () {
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
      const platform = await talentLayerPlatformID.getPlatform(bobPlatformId)
      const bobPlatformProposalPostingFee = platform.proposalPostingFee

      // Carol creates a proposal on Platform 2
      await talentLayerService
        .connect(carol)
        .createProposal(
          carolTlId,
          1,
          rateToken,
          2,
          bobPlatformId,
          'proposal1FromCarolToAlice1Service',
          proposalExpirationDate,
          {
            value: bobPlatformProposalPostingFee,
          },
        )
      await talentLayerService.services(1)
      // get proposal info
      const carolTid = await talentLayerID.ids(carol.address)
      await talentLayerService.getProposal(1, carolTid)
    })

    it('Should revert if Carol tries to create a proposal with a non-whitelisted payment token', async function () {
      const platform = await talentLayerPlatformID.getPlatform(alicePlatformId)
      const alicePlatformProposalPostingFee = platform.proposalPostingFee

      expect(
        talentLayerService
          .connect(carol)
          .createProposal(
            carolTlId,
            1,
            nonListedRateToken,
            2,
            alicePlatformId,
            'proposal1FromCarolToAlice1Service',
            proposalExpirationDate,
            { value: alicePlatformProposalPostingFee },
          ),
      ).to.be.revertedWith('This token is not allowed')
    })

    it('Bob can update his first proposal ', async function () {
      const bobTid = await talentLayerID.ids(bob.address)
      const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'

      const proposalDataBefore = await talentLayerService.getProposal(1, bobTid)
      expect(proposalDataBefore.rateAmount.toString()).to.be.equal('1')

      await talentLayerService
        .connect(bob)
        .updateProposal(
          bobTlId,
          1,
          rateToken,
          2,
          'updateProposal1FromBobToAlice1Service',
          proposalExpirationDate,
        )

      const proposalDataAfter = await talentLayerService.getProposal(1, bobTid)
      expect(proposalDataAfter.rateAmount.toString()).to.be.equal('2')
      expect(proposalDataAfter.dataUri).to.be.equal('updateProposal1FromBobToAlice1Service')
    })

    it('Should revert if Bob updates his proposal with a non-whitelisted payment token ', async function () {
      await expect(
        talentLayerService
          .connect(bob)
          .updateProposal(
            bobTlId,
            1,
            nonListedRateToken,
            2,
            'updateProposal1FromBobToAlice1Service',
            proposalExpirationDate,
          ),
      ).to.be.revertedWith('This token is not allowed')
    })
  })

  describe('Escrow Contract test.', function () {
    describe('Successful use of Escrow for a service using an ERC20 token.', function () {
      const amountBob = 1000000
      const amountCarol = 2000
      const serviceId = 2
      const transactionId = 0
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later
      const proposalDataUri = '' //Will be set later

      it('Alice can NOT deposit tokens to escrow yet because there is no valid proposal', async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountBob)
        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(serviceId, proposalIdBob, '_metaEvidence', proposalDataUri),
        ).to.be.revertedWith('ERC721: invalid token ID')
      })

      it('Bob can make a second proposal on the Alice service n°2 on Platform n°2', async function () {
        const platform = await talentLayerPlatformID.getPlatform(bobPlatformId)
        const bobPlatformProposalPostingFee = platform.proposalPostingFee

        proposalIdBob = (await talentLayerID.ids(bob.address)).toNumber()
        await talentLayerService
          .connect(bob)
          .createProposal(
            bobTlId,
            serviceId,
            token.address,
            amountBob,
            bobPlatformId,
            'proposal2FromBobToAlice2Service',
            proposalExpirationDate,
            { value: bobPlatformProposalPostingFee },
          )
      })

      it('Carol can make her second proposal on the Alice service n°2', async function () {
        const platform = await talentLayerPlatformID.getPlatform(bobPlatformId)
        const bobPlatformProposalPostingFee = platform.proposalPostingFee

        proposalIdCarol = (await talentLayerID.ids(carol.address)).toNumber()
        await talentLayerService
          .connect(carol)
          .createProposal(
            carolTlId,
            serviceId,
            token.address,
            amountCarol,
            bobPlatformId,
            'proposal2FromCarolToAlice2Service',
            proposalExpirationDate,
            { value: bobPlatformProposalPostingFee },
          )
      })

      it('Alice cannot update protocolEscrowFeeRate or protocolWallet', async function () {
        await expect(
          talentLayerEscrow.connect(alice).updateProtocolEscrowFeeRate(4000),
        ).to.be.revertedWith('Ownable: caller is not the owner')
        await expect(
          talentLayerEscrow.connect(alice).updateProtocolWallet(dave.address),
        ).to.be.revertedWith('Ownable: caller is not the owner')
      })

      it('The Deployer can update protocolEscrowFeeRate and protocolWallet', async function () {
        chainId = network.config.chainId ? network.config.chainId : Network.LOCAL
        networkConfig = getConfig(chainId)
        let protocolWallet = await talentLayerEscrow.connect(deployer).protocolWallet()

        expect(protocolWallet).to.equal(networkConfig.multisigAddressList.fee)
        await talentLayerEscrow.connect(deployer).updateProtocolWallet(dave.address)
        protocolWallet = await talentLayerEscrow.connect(deployer).protocolWallet()
        expect(protocolWallet).to.equal(dave.address)

        await talentLayerEscrow.connect(deployer).updateProtocolEscrowFeeRate(800)
        const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
        expect(protocolEscrowFeeRate).to.equal(800)
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        await talentLayerPlatformID.connect(alice).updateOriginServiceFeeRate(alicePlatformId, 1100)
        await talentLayerPlatformID
          .connect(bob)
          .updateOriginValidatedProposalFeeRate(bobPlatformId, 2200)

        const alicePlatformData = await talentLayerPlatformID.platforms(alicePlatformId)
        const bobPlatformData = await talentLayerPlatformID.platforms(bobPlatformId)

        const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
        const originServiceFeeRate = alicePlatformData.originServiceFeeRate
        const originValidatedProposalFeeRate = bobPlatformData.originValidatedProposalFeeRate

        totalAmount =
          amountBob +
          (amountBob *
            (protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)) /
            10000

        await token.connect(alice).approve(talentLayerEscrow.address, totalAmount)

        // we need to retreive the Bob proposal dataUri
        const proposal = await talentLayerService.proposals(serviceId, bobTlId)

        const transaction = await talentLayerEscrow
          .connect(alice)
          .createTransaction(serviceId, proposalIdBob, '_metaEvidence', proposal.dataUri)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction).to.emit(talentLayerEscrow, 'TransactionCreated')
      })

      it('The deposit should also validate the proposal.', async function () {
        const proposal = await talentLayerService.getProposal(serviceId, proposalIdBob)
        await expect(proposal.status.toString()).to.be.equal('1')
      })

      it('The deposit should also update the service with transactionId, proposalId, and status.', async function () {
        const service = await talentLayerService.getService(serviceId)
        await expect(service.status.toString()).to.be.equal('1')
        await expect(service.transactionId.toString()).to.be.equal('0')
        await expect(service.acceptedProposalId).to.be.equal(proposalIdBob)
      })

      it("Alice can NOT deposit funds for Carol's proposal.", async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountCarol)
        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(serviceId, proposalIdCarol, '_metaEvidence', proposalDataUri),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(
          talentLayerEscrow.connect(carol).release(carolTlId, transactionId, 10),
        ).to.be.revertedWith('Access denied')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolEscrowFeeRate = transactionDetails.protocolEscrowFeeRate
        const originServiceFeeRate = transactionDetails.originServiceFeeRate
        const originValidatedProposalFeeRate = transactionDetails.originValidatedProposalFeeRate

        const transaction = await talentLayerEscrow
          .connect(alice)
          .release(aliceTlId, transactionId, amountBob / 2)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )
        const alicePlatformBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const bobPlatformBalance = await talentLayerEscrow
          .connect(bob)
          .getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // Alice gets originServiceFeeRate as the service was created on her platform
        await expect(alicePlatformBalance.toString()).to.be.equal(
          (((amountBob / 2) * originServiceFeeRate) / 10000).toString(),
        )
        // Bob gets originProposalValidatedFeeRate as the proposal was validated on his platform
        await expect(bobPlatformBalance.toString()).to.be.equal(
          (((amountBob / 2) * originValidatedProposalFeeRate) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(
          (((amountBob / 2) * protocolEscrowFeeRate) / 10000).toString(),
        )
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolEscrowFeeRate = transactionDetails.protocolEscrowFeeRate
        const originServiceFeeRate = transactionDetails.originServiceFeeRate
        const originValidatedProposalFeeRate = transactionDetails.originValidatedProposalFeeRate

        const transaction = await talentLayerEscrow
          .connect(alice)
          .release(aliceTlId, transactionId, amountBob / 4)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )

        const alicePlatformBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const bobPlatformBalance = await talentLayerEscrow
          .connect(bob)
          .getClaimableFeeBalance(token.address)
        const deployerBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // Alice gets originServiceFeeRate as the service was created on her platform
        await expect(alicePlatformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * originServiceFeeRate) / 10000).toString(),
        )
        // Bob gets originProposalValidatedFeeRate as the proposal was validated on his platform
        await expect(bobPlatformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * originValidatedProposalFeeRate) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * protocolEscrowFeeRate) / 10000).toString(),
        )
      })

      it('After a service has been cancelled, the owner cannot validate a proposal by depositing fund', async function () {
        // Create the service
        const serviceId = 6
        const proposalIdBob = (await talentLayerID.ids(bob.address)).toNumber()
        await talentLayerService.connect(alice).createService(aliceTlId, 1, 'CID6')
        await talentLayerService.services(serviceId)
        // Create the proposal
        const rateToken = '0xC01FcDfDE3B2ABA1eab76731493C617FfAED2F10'
        const platform = await talentLayerPlatformID.getPlatform(alicePlatformId)
        const alicePlatformProposalPostingFee = platform.proposalPostingFee
        await talentLayerService
          .connect(bob)
          .createProposal(
            bobTlId,
            serviceId,
            rateToken,
            1,
            alicePlatformId,
            'proposalOnService',
            proposalExpirationDate,
            {
              value: alicePlatformProposalPostingFee,
            },
          )
        // Cancel the service
        await talentLayerService.connect(alice).cancelService(aliceTlId, serviceId)
        // Try to deposit fund to validate the proposal
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolEscrowFeeRate = transactionDetails.protocolEscrowFeeRate
        const originServiceFeeRate = transactionDetails.originServiceFeeRate
        const originValidatedProposalFeeRate = transactionDetails.originValidatedProposalFeeRate
        totalAmount =
          amountBob +
          (amountBob *
            (protocolEscrowFeeRate + originServiceFeeRate + originValidatedProposalFeeRate)) /
            10000

        await token.connect(alice).approve(talentLayerEscrow.address, totalAmount)

        // we need to retreive the Bob proposal dataUri
        const proposal = await talentLayerService.proposals(serviceId, bobTlId)

        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(serviceId, proposalIdBob, '_metaEvidence', proposal.dataUri),
        ).to.be.revertedWith('Service status not open')
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(
          talentLayerEscrow.connect(carol).reimburse(carolTlId, transactionId, totalAmount / 4),
        ).to.revertedWith('Access denied')
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(
          talentLayerEscrow.connect(bob).reimburse(bobTlId, transactionId, totalAmount),
        ).to.revertedWith('Insufficient funds')
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerEscrow
          .connect(bob)
          .reimburse(bobTlId, transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function)
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction).to.emit(talentLayerEscrow, 'PaymentCompleted').withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left. ', async function () {
        await expect(
          talentLayerEscrow.connect(alice).release(aliceTlId, transactionId, 1),
        ).to.be.revertedWith('Insufficient funds')
      })

      it('Alice can claim her token balance.', async function () {
        const platformBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(token.address)
        const transaction = await talentLayerEscrow.connect(alice).claim(platformId, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, alice.address],
          [-platformBalance, platformBalance],
        )
      })

      it('The protocol owner can claim his token balance.', async function () {
        const protocolOwnerBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(token.address)
        // await talentLayerEscrow.updateProtocolWallet(alice.address);
        const transaction = await talentLayerEscrow.connect(deployer).claim(0, token.address)
        await expect(transaction).to.changeTokenBalances(
          token,
          [talentLayerEscrow.address, dave.address],
          [-protocolOwnerBalance, protocolOwnerBalance],
        )
      })
    })

    describe('Successful use of Escrow for a service using ETH.', function () {
      const amountBob = 1000000
      const amountCarol = 200
      const serviceId = 3
      const transactionId = 1
      let proposalIdBob = 0 //Will be set later
      let proposalIdCarol = 0 //Will be set later
      let totalAmount = 0 //Will be set later
      const ethAddress = '0x0000000000000000000000000000000000000000'

      //Service 3 created on Alice's platform
      //
      it('Alice can NOT deposit eth to escrow yet.', async function () {
        await talentLayerPlatformID.connect(alice).updateOriginServiceFeeRate(alicePlatformId, 1100)
        await talentLayerPlatformID
          .connect(bob)
          .updateOriginValidatedProposalFeeRate(bobPlatformId, 2200)
        const alicePlatformData = await talentLayerPlatformID.platforms(alicePlatformId)
        const bobPlatformData = await talentLayerPlatformID.platforms(bobPlatformId)
        const protocolEscrowFeeRate = await talentLayerEscrow.protocolEscrowFeeRate()
        const originServiceFeeRate = alicePlatformData.originServiceFeeRate
        const originValidatedProposalFeeRate = bobPlatformData.originValidatedProposalFeeRate

        totalAmount =
          amountBob +
          (amountBob *
            (protocolEscrowFeeRate + originValidatedProposalFeeRate + originServiceFeeRate)) /
            10000

        // we need to retreive the Bob proposal dataUri
        const proposal = await talentLayerService.proposals(serviceId, bobTlId)

        await token.connect(alice).approve(talentLayerEscrow.address, totalAmount)
        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(serviceId, proposalIdBob, '_metaEvidence', proposal.dataUri),
        ).to.be.reverted
      })

      it("Bob can register a proposal on bob's platform.", async function () {
        const platform = await talentLayerPlatformID.getPlatform(bobPlatformId)
        const bobPlatformProposalPostingFee = platform.proposalPostingFee

        proposalIdBob = (await talentLayerID.ids(bob.address)).toNumber()
        await talentLayerService
          .connect(bob)
          .createProposal(
            bobTlId,
            serviceId,
            ethAddress,
            amountBob,
            bobPlatformId,
            'proposal3FromBobToAlice3Service',
            proposalExpirationDate,
            { value: bobPlatformProposalPostingFee },
          )
      })

      it("Carol can register a proposal on bob's platform.", async function () {
        const platform = await talentLayerPlatformID.getPlatform(bobPlatformId)
        const bobPlatformProposalPostingFee = platform.proposalPostingFee

        proposalIdCarol = (await talentLayerID.ids(carol.address)).toNumber()
        await talentLayerService
          .connect(carol)
          .createProposal(
            carolTlId,
            serviceId,
            ethAddress,
            amountCarol,
            bobPlatformId,
            'proposal3FromCarolToAlice3Service',
            proposalExpirationDate,
            { value: bobPlatformProposalPostingFee },
          )
      })

      // bob will try to frunt run the proposal by changing the proposal dataUri
      it('Bob will try to front run the proposal validation by changing the proposal dataUri.', async function () {
        await talentLayerService
          .connect(bob)
          .updateProposal(
            bobTlId,
            serviceId,
            ethAddress,
            amountBob,
            'frontRunProposal3FromBobToAlice3Service',
            proposalExpirationDate,
          )

        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(
              serviceId,
              proposalIdBob,
              '_metaEvidence',
              'proposal3FromBobToAlice3Service',
              {
                value: totalAmount,
              },
            ),
        ).to.be.revertedWith('Proposal dataUri has changed')
      })

      it("Alice can deposit funds for Bob's proposal, which will emit an event.", async function () {
        const proposal = await talentLayerService.proposals(serviceId, bobTlId)
        const transaction = await talentLayerEscrow
          .connect(alice)
          .createTransaction(serviceId, proposalIdBob, '_metaEvidence', proposal.dataUri, {
            value: totalAmount,
          })
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [totalAmount, -totalAmount, 0],
        )

        await expect(transaction).to.emit(talentLayerEscrow, 'TransactionCreated')
      })

      it('The deposit should also validate the proposal.', async function () {
        const proposal = await talentLayerService.getProposal(serviceId, proposalIdBob)
        await expect(proposal.status.toString()).to.be.equal('1')
      })

      it('The deposit should also update the service with transactionId, proposalId, and status.', async function () {
        const service = await talentLayerService.getService(serviceId)
        await expect(service.status.toString()).to.be.equal('1')
        await expect(service.transactionId).to.be.equal(transactionId)
        await expect(service.acceptedProposalId.toNumber()).to.be.equal(proposalIdBob)
      })

      it("Alice can NOT deposit funds for Carol's proposal, and NO event should emit.", async function () {
        await token.connect(alice).approve(talentLayerEscrow.address, amountCarol)
        await expect(
          talentLayerEscrow
            .connect(alice)
            .createTransaction(serviceId, proposalIdCarol, '_metaEvidence', 'dataUri', {
              value: amountCarol,
            }),
        ).to.be.reverted
      })

      it('Carol should not be allowed to release escrow the service.', async function () {
        await expect(
          talentLayerEscrow.connect(carol).release(carolTlId, transactionId, 10),
        ).to.be.revertedWith('Access denied')
      })

      it('Alice can release half of the escrow to bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolEscrowFeeRate = transactionDetails.protocolEscrowFeeRate
        const originServiceFeeRate = transactionDetails.originServiceFeeRate
        const originValidatedProposalFeeRate = transactionDetails.originValidatedProposalFeeRate

        const transaction = await talentLayerEscrow
          .connect(alice)
          .release(aliceTlId, transactionId, amountBob / 2)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 2, 0, amountBob / 2],
        )

        const alicePlatformBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const bobPlatformBalance = await talentLayerEscrow
          .connect(bob)
          .getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        // Alice gets the originServiceFeeRate as the service was created on her platform
        await expect(alicePlatformBalance.toString()).to.be.equal(
          (((amountBob / 2) * originServiceFeeRate) / 10000).toString(),
        )
        // Bob gets the originValidatedProposalFeeRate as the proposal was created on his platform
        await expect(bobPlatformBalance.toString()).to.be.equal(
          (((amountBob / 2) * originValidatedProposalFeeRate) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(
          (((amountBob / 2) * protocolEscrowFeeRate) / 10000).toString(),
        )
      })

      it('Alice can release a quarter of the escrow to Bob, and fees are correctly split.', async function () {
        const transactionDetails = await talentLayerEscrow
          .connect(alice)
          .getTransactionDetails(transactionId.toString())
        const protocolEscrowFeeRate = transactionDetails.protocolEscrowFeeRate
        const originServiceFeeRate = transactionDetails.originServiceFeeRate
        const originValidatedProposalFeeRate = transactionDetails.originValidatedProposalFeeRate

        const transaction = await talentLayerEscrow
          .connect(alice)
          .release(aliceTlId, transactionId, amountBob / 4)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-amountBob / 4, 0, amountBob / 4],
        )
        const alicePlatformBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const bobPlatformBalance = await talentLayerEscrow
          .connect(bob)
          .getClaimableFeeBalance(ethAddress)
        const deployerBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        // Alice gets the originServiceFeeRate as the service was created on her platform
        await expect(alicePlatformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * originServiceFeeRate) / 10000).toString(),
        )
        // Bob gets the originValidatedProposalFeeRate as the proposal was created on his platform
        await expect(bobPlatformBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * originValidatedProposalFeeRate) / 10000).toString(),
        )
        await expect(deployerBalance.toString()).to.be.equal(
          ((((3 * amountBob) / 4) * protocolEscrowFeeRate) / 10000).toString(),
        )
      })

      it('Carol can NOT reimburse alice.', async function () {
        await expect(
          talentLayerEscrow.connect(carol).reimburse(carolTlId, transactionId, totalAmount / 4),
        ).to.revertedWith('Access denied')
      })

      it('Bob can NOT reimburse alice for more than what is left in escrow.', async function () {
        await expect(
          talentLayerEscrow.connect(bob).reimburse(bobTlId, transactionId, totalAmount),
        ).to.revertedWith('Insufficient funds')
      })

      it('Bob can reimburse alice for what is left in the escrow, an emit will be sent.', async function () {
        const transaction = await talentLayerEscrow
          .connect(bob)
          .reimburse(bobTlId, transactionId, amountBob / 4)
        /* When asking for the reimbursement of a fee-less amount,
         * we expect the amount reimbursed to include all fees (calculated by the function)
         * hence the 'totalAmount / 4' expected.
         */
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice, bob],
          [-totalAmount / 4, totalAmount / 4, 0],
        )
        await expect(transaction).to.emit(talentLayerEscrow, 'PaymentCompleted').withArgs(serviceId)
      })

      it('Alice can not release escrow because there is none left.', async function () {
        await expect(
          talentLayerEscrow.connect(alice).release(aliceTlId, transactionId, 10),
        ).to.be.revertedWith('Insufficient funds')
      })

      it('Alice can claim her ETH balance.', async function () {
        const platformEthBalance = await talentLayerEscrow
          .connect(alice)
          .getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerEscrow.connect(alice).claim(platformId, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, alice.address],
          [-platformEthBalance, platformEthBalance],
        )
      })

      it('The Protocol owner can claim his ETH balance.', async function () {
        const protocolEthBalance = await talentLayerEscrow
          .connect(deployer)
          .getClaimableFeeBalance(ethAddress)
        const transaction = await talentLayerEscrow.connect(deployer).claim(0, ethAddress)
        await expect(transaction).to.changeEtherBalances(
          [talentLayerEscrow.address, dave.address],
          [-protocolEthBalance, protocolEthBalance],
        )
      })
    })
  })

  describe('Talent Layer Review contract test', function () {
    it("Bob can't write a review yet", async function () {
      await expect(
        talentLayerReview.connect(bob).addReview(bobTlId, 1, 'cidReview', 3, 1),
      ).to.be.revertedWith("You're not an actor of this service")
    })

    it("Carol can't write a review as she's not linked to this service", async function () {
      await expect(
        talentLayerReview.connect(carol).addReview(carolTlId, 1, 'cidReview', 5, 1),
      ).to.be.revertedWith("You're not an actor of this service")
    })

    it("Alice and Bob can't write a review for the same Service", async function () {
      await expect(
        talentLayerReview.connect(alice).addReview(aliceTlId, 1, 'cidReview', 3, 1),
      ).to.be.revertedWith('The service is not finished yet')
      await expect(
        talentLayerReview.connect(bob).addReview(bobTlId, 1, 'cidReview', 3, 1),
      ).to.be.revertedWith(`You're not an actor of this service`)
    })

    it('Alice and Bob can write a review now and we can get review data', async function () {
      await talentLayerReview.connect(alice).addReview(aliceTlId, 2, 'cidReview1', 2, 1)
      await talentLayerReview.connect(bob).addReview(bobTlId, 2, 'cidReview2', 4, 1)

      const reviewData1 = await talentLayerReview.getReview(0)
      const reviewData2 = await talentLayerReview.getReview(1)

      expect(reviewData1.dataUri).to.be.equal('cidReview1')
      expect(reviewData2.dataUri).to.be.equal('cidReview2')

      expect(await reviewData1.platformId).to.be.equal(1)
    })
  })

  describe('Talent Layer Arbitrator contract test', function () {
    it('the owner of the platform can update the arbitration price', async function () {
      const newArbitrationPrice = 1000
      const platformId = 1

      // It fails if the caller is not the owner of the platform
      const tx = talentLayerArbitrator
        .connect(bob)
        .setArbitrationPrice(platformId, newArbitrationPrice)
      await expect(tx).to.be.revertedWith("You're not the owner of the platform")

      // It succeeds if the caller is the owner of the platform
      await talentLayerArbitrator
        .connect(alice)
        .setArbitrationPrice(platformId, newArbitrationPrice)
      const extraData = ethers.utils.hexZeroPad(ethers.utils.hexlify(platformId), 32)
      const updatedArbitrationPrice = await talentLayerArbitrator.arbitrationCost(extraData)
      expect(updatedArbitrationPrice).to.be.equal(newArbitrationPrice)
    })
  })
})
