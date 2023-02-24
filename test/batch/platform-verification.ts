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
      /*
       * 1. get the message hash => 32bytes, 66 caracteres
       * 2. sign the message hash with the private key of the owner of the platform with 'getEthSignedMessageHash' system => 64 bytes, 132 caracteres
       * 3. send signature to the contract
       * 4. the contract rebuild the message hash with same data
       * 5. It transforms the message in "ethSignedMessage"
       * 6. It recovers the address of the signer
       */

      // Alice want to create a service with a new cid
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['createService', cid, aliceTlId, 0],
      )

      // Carol the owner of the platform signed the message with her private key
      const signature = await carol.signMessage(ethers.utils.arrayify(messageHash))

      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateService must revert if the signature is invalid, here the cid is different', async function () {
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['createService', cid, aliceTlId, 0],
      )

      // Carol the owner of the platform signed the message with her private key
      const signature = await carol.signMessage(ethers.utils.arrayify(messageHash))

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(alice)
        .createService(
          aliceTlId,
          carolPlatformId,
          'QmQLVYemsvvqk58y8UTrCEp8MrcQaMzzT2e2duDEmFG99A',
          signature,
        )

      await expect(tx).to.reverted
    })

    it('CreateService must be replay resistent with the nonce system', async function () {
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['createService', cid, aliceTlId, 0],
      )

      // Carol the owner of the platform signed the message with her private key
      const signature = await carol.signMessage(ethers.utils.arrayify(messageHash))

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.reverted
    })

    it('CreateService must work with nonce incrementation', async function () {
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['createService', cid, aliceTlId, 1],
      )

      // Carol the owner of the platform signed the message with her private key
      const signature = await carol.signMessage(ethers.utils.arrayify(messageHash))

      // Try to use the same signature with a different cid
      const tx = talentLayerService
        .connect(alice)
        .createService(aliceTlId, carolPlatformId, cid, signature)

      await expect(tx).to.not.reverted
    })

    it('CreateProposal must validate the signature while a user create a proposal linked to certain platform', async function () {
      const serviceId = 1

      // Post a proposal from bob
      const messageHash = ethers.utils.solidityKeccak256(
        ['string', 'string', 'uint256', 'uint256'],
        ['createProposal', cid, bobTlId, serviceId],
      )

      // Carol the owner of the platform signed the message with her private key
      const signature = await carol.signMessage(ethers.utils.arrayify(messageHash))

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
