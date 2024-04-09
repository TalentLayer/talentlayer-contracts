// eslint-disable-next-line @typescript-eslint/no-var-requires
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import {
  SimpleERC20,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerID,
  TalentLayerIDV2,
  TalentLayerPlatformID,
  TalentLayerReview,
  TalentLayerService,
} from '../../typechain-types'
import { cid, MintStatus, proposalExpirationDate } from '../utils/constant'
import { deploy } from '../utils/deploy'
import { getSignatureForService, getSignatureForProposal } from '../utils/signature'

const carolPlatformId = 1

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [
    TalentLayerID,
    TalentLayerPlatformID,
    TalentLayerEscrow,
    TalentLayerArbitrator,
    TalentLayerService,
    TalentLayerReview,
    SimpleERC20,
  ]
> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    talentLayerService,
    talentLayerReview,
    simpleERC20,
  ] = await deploy(false)

  // Deployer mints Platform Id for Carol
  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, carol.address)

  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)
  await talentLayerService
    .connect(deployer)
    .updateAllowedTokenList(ethers.constants.AddressZero, true, 1)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob__')

  // Set service contract address on ID contract
  await talentLayerID.connect(deployer).setIsServiceContract(talentLayerService.address, true)

  return [
    talentLayerID,
    talentLayerPlatformID,
    talentLayerEscrow,
    talentLayerArbitrator,
    talentLayerService,
    talentLayerReview,
    simpleERC20,
  ]
}

describe('Audit test', function () {
  let deployer: SignerWithAddress,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress,
    dave: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerIDV2: TalentLayerIDV2,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerService: TalentLayerService,
    talentLayerReview: TalentLayerReview,
    simpleERC20: SimpleERC20

  before(async function () {
    ;[deployer, alice, bob, carol, dave] = await ethers.getSigners()
    ;[
      talentLayerID,
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerArbitrator,
      talentLayerService,
      talentLayerReview,
      simpleERC20,
    ] = await deployAndSetup()
  })

  describe('Try hack scenarios', async function () {
    it('Escrow must prevent anyone to use claim function with random ERC20', async function () {
      await simpleERC20.connect(deployer).transfer(alice.address, ethers.utils.parseEther('10'))

      await simpleERC20
        .connect(alice)
        .transfer(talentLayerEscrow.address, ethers.utils.parseEther('10'))

      const tx = talentLayerEscrow.connect(alice).claim('1', simpleERC20.address)
      await expect(tx).to.revertedWith('nothing to claim')
    })

    it('must prevent to create a proposal on a non existent Service', async function () {
      const aliceTlId = await talentLayerID.connect(alice).ids(alice.address)
      const signature = await getSignatureForService(carol, aliceTlId.toNumber(), 0, cid)
      await talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature, {
          value: 0,
        })

      const bobTlId = await talentLayerID.connect(bob).ids(bob.address)
      const signature2 = await getSignatureForProposal(carol, bobTlId.toNumber(), 0, cid)
      const tx = talentLayerService
        .connect(bob)
        .createProposal(
          bobTlId,
          99,
          ethers.constants.AddressZero,
          1000,
          carolPlatformId,
          cid,
          proposalExpirationDate,
          signature2,
        )
      await expect(tx).to.revertedWith('Service not exist')
    })
  })
})
