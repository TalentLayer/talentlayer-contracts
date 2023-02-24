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
import { getSignatureForProposal, getSignatureForService } from '../utils/signature'

const aliceTlId = 1
const bobTlId = 2
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

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Mint TL Id for Alice and Bob
  await talentLayerID.connect(alice).mint(carolPlatformId, 'alice')
  await talentLayerID.connect(bob).mint(carolPlatformId, 'bob__')

  await talentLayerService
    .connect(deployer)
    .updateAllowedTokenList(ethers.constants.AddressZero, true, 1)

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

describe('Platform verification', function () {
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

  describe('TalentLayerService must handle platform verification', async function () {
    it('CreateService must validate the signature while a user create a service linked to certain platform', async function () {
      const signature = await getSignatureForService(carol, aliceTlId, 0)

      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateService must revert if Bob use the signature generate for Alice', async function () {
      const signature = await getSignatureForService(carol, aliceTlId, 0)

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(bob)
        .createService(bobTlId, carolPlatformId, cid, signature)

      await expect(tx).to.reverted
    })

    it('CreateService must revert if Bob generate the signature for carol platform', async function () {
      const signature = await getSignatureForService(bob, bobTlId, 0)

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(bob)
        .createService(bobTlId, carolPlatformId, cid, signature)

      await expect(tx).to.reverted
    })

    it('CreateService must be replay resistent with the nonce system so Alice can not use the same signature again', async function () {
      const signature = await getSignatureForService(carol, aliceTlId, 0)

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.reverted
    })

    it('CreateService must work with nonce incrementation', async function () {
      const signature = await getSignatureForService(carol, aliceTlId, 1)

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateProposal must validate the signature while a user create a proposal linked to certain platform', async function () {
      const serviceId = 1
      const signature = await getSignatureForProposal(carol, bobTlId, serviceId)

      const tx = talentLayerService
        .connect(bob)
        .createProposal(
          bobTlId,
          serviceId,
          ethers.constants.AddressZero,
          1,
          carolPlatformId,
          cid,
          proposalExpirationDate,
          signature,
        )

      await expect(tx).to.not.reverted
    })
  })
})
