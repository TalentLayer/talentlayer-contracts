import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address'
import { expect } from 'chai'
import { BigNumber } from 'ethers'
import { ethers } from 'hardhat'
import {
  ServiceRegistry,
  TalentLayerArbitrator,
  TalentLayerEscrow,
  TalentLayerID,
  TalentLayerPlatformID,
} from '../../typechain-types'
import { deploy } from '../utils/deploy'

describe('Load test', function () {
  let deployer: SignerWithAddress,
    platform: SignerWithAddress,
    platformId: BigNumber,
    signers: SignerWithAddress[],
    talentLayerID: TalentLayerID,
    talentLayerPlatformID: TalentLayerPlatformID,
    talentLayerArbitrator: TalentLayerArbitrator,
    talentLayerEscrow: TalentLayerEscrow,
    serviceRegistry: ServiceRegistry

  //Each buyer creates a given amount of open services. Each seller creates a proposal for all services.
  //Buyers and sellers are two distinct sets of TalentLayerIDs.
  //50 services per buyer with 20 buyers creates a total of 1000 services, and 40 sellers will then create 10000 proposals each, a total of 40000 proposals.
  //100 accounts currently created, set in hardhat.config. Needs to be at least amount_of_buyers + amount_of_sellers + 2 (for deployer and platform).
  //VALUE will currently make no difference because no transaction takes place.
  const AMOUNT_OF_SERVICES_PER_BUYER = 50,
    AMOUNT_OF_BUYERS = 20,
    AMOUNT_OF_SERVICES: number = AMOUNT_OF_BUYERS * AMOUNT_OF_SERVICES_PER_BUYER,
    AMOUNT_OF_PROPOSALS_PER_SELLER: number = AMOUNT_OF_SERVICES,
    AMOUNT_OF_SELLERS = 40,
    AMOUNT_OF_PROPOSALS: number = AMOUNT_OF_PROPOSALS_PER_SELLER * AMOUNT_OF_SELLERS,
    AMOUNT_OF_SIGNERS: number = AMOUNT_OF_BUYERS + AMOUNT_OF_SELLERS,
    TOKEN = '0x0000000000000000000000000000000000000000',
    VALUE = 10,
    MOCK_DATA = 'mock_data'

  before(async function () {
    signers = await ethers.getSigners()
    deployer = signers[0]
    platform = signers[1]
    signers = signers.slice(2)
    ;[
      talentLayerID,
      talentLayerPlatformID,
      talentLayerEscrow,
      talentLayerArbitrator,
      serviceRegistry,
    ] = await deploy(false)

    // Grant Platform Id Mint role to Alice
    const mintRole = await talentLayerPlatformID.MINT_ROLE()
    await talentLayerPlatformID.connect(deployer).grantRole(mintRole, platform.address)

    // platform mints a Platform Id
    await talentLayerPlatformID.connect(platform).mint('someName')
    platformId = await talentLayerPlatformID.connect(platform).ids(platform.address)
  })

  describe('Creating ' + AMOUNT_OF_SIGNERS + ' TalentLayerIDs', async function () {
    it(AMOUNT_OF_SIGNERS + ' TalentLayerIDs minted', async function () {
      for (let i = 0; i < AMOUNT_OF_SIGNERS; i++) {
        await expect(await talentLayerID.connect(signers[i]).mint(platformId, 'handle_' + i)).to.not
          .be.reverted
      }
    })
  })

  describe('Creating ' + AMOUNT_OF_SERVICES + ' services', async function () {
    const createServices = (signerIndex: number) =>
      async function () {
        for (let i = 0; i < AMOUNT_OF_SERVICES_PER_BUYER; i++) {
          const talentLayerId = await talentLayerID
            .connect(signers[signerIndex])
            .ids(signers[signerIndex].address)
          await expect(
            await serviceRegistry
              .connect(signers[signerIndex])
              .createOpenServiceFromBuyer(talentLayerId, platformId, MOCK_DATA + '_' + i),
          ).to.emit(serviceRegistry, 'ServiceCreated')
        }
      }

    for (let signerIndex = 0; signerIndex < AMOUNT_OF_BUYERS; signerIndex++) {
      it(
        'Signer ' + signerIndex + ' created ' + AMOUNT_OF_SERVICES_PER_BUYER + ' services',
        createServices(signerIndex),
      )
    }
  })

  describe('Creating ' + AMOUNT_OF_PROPOSALS + ' proposals', async function () {
    const createProposals = (signerIndex: number) =>
      async function () {
        for (let serviceId = 1; serviceId <= AMOUNT_OF_SERVICES; serviceId++) {
          const talentLayerId = await talentLayerID
            .connect(signers[signerIndex])
            .ids(signers[signerIndex].address)
          await expect(
            await serviceRegistry
              .connect(signers[signerIndex])
              .createProposal(talentLayerId, serviceId, TOKEN, VALUE, platformId, MOCK_DATA),
          ).to.emit(serviceRegistry, 'ProposalCreated')
        }
      }

    for (let i = 0; i < AMOUNT_OF_SELLERS; i++) {
      const signerIndex = AMOUNT_OF_BUYERS + i
      it(
        'Signer ' + signerIndex + ' created ' + AMOUNT_OF_PROPOSALS_PER_SELLER + ' proposals',
        createProposals(signerIndex),
      )
    }
  })
})
