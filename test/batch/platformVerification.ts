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
  const [deployer, alice, bob, carol, carolPlatformSigner] = await ethers.getSigners()
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

  // Update signer address for Carol's platform
  await talentLayerPlatformID
    .connect(carol)
    .updateSigner(carolPlatformId, carolPlatformSigner.address)

  // Disable whitelist for reserved handles
  await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)

  // Set service contract address on ID contract
  await talentLayerID.connect(deployer).setIsServiceContract(talentLayerService.address, true)

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
    carolPlatformSigner: SignerWithAddress,
    platformOneOwner: SignerWithAddress,
    platformOneSigner: SignerWithAddress,
    talentLayerID: TalentLayerID,
    talentLayerIDV2: TalentLayerIDV2,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerEscrow: TalentLayerEscrow,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerService: TalentLayerService,
    talentLayerReview: TalentLayerReview,
    simpleERC20: SimpleERC20

  before(async function () {
    ;[deployer, alice, bob, carol, carolPlatformSigner] = await ethers.getSigners()
    platformOneOwner = carol
    platformOneSigner = carolPlatformSigner
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
      const signature = await getSignatureForService(platformOneSigner, aliceTlId, 0, cid)

      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateService must revert if Bob uses the signature generated for Alice', async function () {
      const signature = await getSignatureForService(platformOneSigner, aliceTlId, 0, cid)

      const tx = talentLayerService
        .connect(bob)
        .createService(bobTlId, carolPlatformId, cid, signature)

      await expect(tx).to.revertedWith('invalid signature')
    })

    it('CreateService must revert if Bob generated the signature for carol platform', async function () {
      const signature = await getSignatureForService(bob, bobTlId, 0, cid)

      const tx = talentLayerService
        .connect(bob)
        .createService(bobTlId, carolPlatformId, cid, signature)

      await expect(tx).to.revertedWith('invalid signature')
    })

    it('CreateService must revert if Bob uses the signature generated by the platform owner instead of signer', async function () {
      const signature = await getSignatureForService(platformOneOwner, bobTlId, 0, cid)

      const tx = talentLayerService
        .connect(bob)
        .createService(bobTlId, carolPlatformId, cid, signature)

      await expect(tx).to.revertedWith('invalid signature')
    })

    it('CreateService must be replay resistent with the nonce system so Alice can not use the same signature again', async function () {
      const signature = await getSignatureForService(platformOneSigner, aliceTlId, 0, cid)

      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.revertedWith('invalid signature')
    })

    it('CreateService must work with nonce incrementation', async function () {
      const signature = await getSignatureForService(platformOneSigner, aliceTlId, 1, cid)

      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateProposal must validate the signature while a user creates a proposal linked to certain platform', async function () {
      const serviceId = 1
      const signature = await getSignatureForProposal(platformOneSigner, bobTlId, serviceId, cid)

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

    it("Service creation should not require a signature if the platform's signer address is set to 0 address", async function () {
      // Update signer address for Carol's platform to zero address
      await talentLayerPlatformID
        .connect(carol)
        .updateSigner(carolPlatformId, ethers.constants.AddressZero)

      expect(await talentLayerPlatformID.getSigner(carolPlatformId)).to.equal(
        ethers.constants.AddressZero,
      )

      // Use a wrong signature to check if the service creation is not blocked by the signature validation
      const signature = await getSignatureForService(platformOneSigner, aliceTlId, 0, cid)

      const tx = await talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it("Proposal creation should not require a signature if the platform's signer address is set to 0 address", async function () {
      const serviceId = 2
      expect(await talentLayerPlatformID.getSigner(carolPlatformId)).to.equal(
        ethers.constants.AddressZero,
      )
      // Use a wrong signature to check if the service creation is not blocked by the signature validation
      const signature = await getSignatureForProposal(platformOneSigner, aliceTlId, serviceId, cid)

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
