import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

const aliceTlId = 1

const reservedHandles = ['alice', 'bob', 'carol']

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerID, MerkleTree, string, MerkleTree, string]> {
  const users = await ethers.getSigners()
  const deployer = users[0]
  const whitelistedUsers = users.slice(1, 4)
  const dave = users[4]

  const [talentLayerID, talentLayerPlatformID] = await deploy(false)

  // Create whitelist of handle reservations
  const whitelist = whitelistedUsers.map(
    (user, index) => `${user.address};${reservedHandles[index]}`,
  )

  // Set whitelist merkle root
  const whitelistMerkleTree = new MerkleTree(whitelist, keccak256, {
    hashLeaves: true,
    sortPairs: true,
  })
  const whitelistMerkleRoot = whitelistMerkleTree.getHexRoot()
  await talentLayerID.setWhitelistMerkleRoot(whitelistMerkleRoot)

  // Set reserved handles merkle root
  const handlesMerkleTree = new MerkleTree(reservedHandles, keccak256, {
    hashLeaves: true,
    sortPairs: true,
  })
  const handlesMerkleRoot = handlesMerkleTree.getHexRoot()
  await talentLayerID.setReservedHandlesMerkleRoot(handlesMerkleRoot)

  // Deployer mints Platform Id for Dave
  const platformName = 'HireVibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, dave.address)

  return [
    talentLayerID,
    whitelistMerkleTree,
    whitelistMerkleRoot,
    handlesMerkleTree,
    handlesMerkleRoot,
  ]
}

describe.only('Whitelist to mint reserved handles', function () {
  let alice: SignerWithAddress,
    talentLayerID: TalentLayerID,
    whitelistMerkleTree: MerkleTree,
    whitelistMerkleRoot: string,
    handlesMerkleTree: MerkleTree,
    handlesMerkleRoot: string

  before(async function () {
    ;[, alice] = await ethers.getSigners()
    ;[
      talentLayerID,
      whitelistMerkleTree,
      whitelistMerkleRoot,
      handlesMerkleTree,
      handlesMerkleRoot,
    ] = await deployAndSetup()
  })

  describe('Handle reservation', async function () {
    it('The reserved handles are reserved', async function () {
      for (const handle of reservedHandles) {
        const proof = handlesMerkleTree.getHexProof(keccak256(handle))
        const isReservedLocally = handlesMerkleTree.verify(
          proof,
          keccak256(handle),
          handlesMerkleRoot,
        )

        expect(isReservedLocally).to.be.true

        const isReservedOnContract = await talentLayerID.isHandleReserved(handle, proof)
        expect(isReservedOnContract).to.be.true
      }
    })

    it('The whitelisted users are whitelisted', async function () {
      expect(true)
    })
  })

  describe('Mint reserved handle', async function () {
    it('Alice cannot mint the handle reserved by someone else', async function () {
      expect(true)
    })

    it('Alice can mint the handle she reserved', async function () {
      expect(true)
    })

    it('Eve can mint a non-reserved handle', async function () {
      expect(true)
    })
  })
})
