import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

const reservedHandles = ['alice', 'bob', 'carol']

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerID, SignerWithAddress[], MerkleTree, string, MerkleTree, string]
> {
  const users = await ethers.getSigners()
  const deployer = users[0]
  const whitelistedUsers = users.slice(1, 4)
  const dave = users[4]

  const [talentLayerID, talentLayerPlatformID] = await deploy(false)

  // Create whitelist of handle reservations
  const whitelist = whitelistedUsers.map(
    (user, index) => `${user.address.toLowerCase()};${reservedHandles[index]}`,
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
    whitelistedUsers,
    whitelistMerkleTree,
    whitelistMerkleRoot,
    handlesMerkleTree,
    handlesMerkleRoot,
  ]
}

describe.only('Whitelist to mint reserved handles', function () {
  let talentLayerID: TalentLayerID,
    whitelistedUsers: SignerWithAddress[],
    whitelistMerkleTree: MerkleTree,
    whitelistMerkleRoot: string,
    handlesMerkleTree: MerkleTree,
    handlesMerkleRoot: string

  before(async function () {
    ;[
      talentLayerID,
      whitelistedUsers,
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

        // Check handle is reserved with local merkle root
        const isReservedLocally = handlesMerkleTree.verify(
          proof,
          keccak256(handle),
          handlesMerkleRoot,
        )
        expect(isReservedLocally).to.be.true

        // Check handle is reserved with the merkle root stored on the contract
        const isReservedOnContract = await talentLayerID.isHandleReserved(handle, proof)
        expect(isReservedOnContract).to.be.true
      }
    })

    it('The whitelisted users are whitelisted', async function () {
      for (const [index, user] of whitelistedUsers.entries()) {
        const address = user.address.toLocaleLowerCase()
        const handle = reservedHandles[index]

        // Check user is whitelisted with local merkle root
        const whitelistEntry = `${address};${handle}`
        const leaf = keccak256(whitelistEntry)
        const proof = whitelistMerkleTree.getHexProof(leaf)
        const isWhitelistedLocally = whitelistMerkleTree.verify(proof, leaf, whitelistMerkleRoot)
        expect(isWhitelistedLocally).to.be.true

        // Check user is whitelisted with local merkle root stored on the contract
        const isWhitelistedOnContract = await talentLayerID.isWhitelisted(address, handle, proof)
        expect(isWhitelistedOnContract).to.be.true
      }
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
