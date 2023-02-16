import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { TalentLayerID } from '../../typechain-types'
import { deploy } from '../utils/deploy'

const platformId = 1
const reservedHandles = ['alice', 'bob', 'carol']

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerID, SignerWithAddress[], SignerWithAddress[], MerkleTree, string, MerkleTree, string]
> {
  const users = await ethers.getSigners()
  const deployer = users[0]
  const whitelistedUsers = users.slice(1, 4)
  const dave = users[4]
  const nonWhitelistedUsers = users.slice(5)

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
    nonWhitelistedUsers,
    whitelistMerkleTree,
    whitelistMerkleRoot,
    handlesMerkleTree,
    handlesMerkleRoot,
  ]
}

describe.only('Whitelist to mint reserved handles', function () {
  let talentLayerID: TalentLayerID,
    whitelistedUsers: SignerWithAddress[],
    nonWhitelistedUsers: SignerWithAddress[],
    whitelistMerkleTree: MerkleTree,
    whitelistMerkleRoot: string,
    handlesMerkleTree: MerkleTree,
    handlesMerkleRoot: string,
    alice: SignerWithAddress

  before(async function () {
    ;[
      talentLayerID,
      whitelistedUsers,
      nonWhitelistedUsers,
      whitelistMerkleTree,
      whitelistMerkleRoot,
      handlesMerkleTree,
      handlesMerkleRoot,
    ] = await deployAndSetup()

    alice = whitelistedUsers[0]
  })

  function getHandleProof(handle: string) {
    return handlesMerkleTree.getHexProof(keccak256(handle))
  }

  function getWhitelistProof(address: string, handle: string): [string[], Buffer] {
    const whitelistEntry = `${address.toLocaleLowerCase()};${handle}`
    const leaf = keccak256(whitelistEntry)
    const proof = whitelistMerkleTree.getHexProof(leaf)
    return [proof, leaf]
  }

  describe('Handle reservation', async function () {
    it('The reserved handles are reserved', async function () {
      for (const handle of reservedHandles) {
        const proof = getHandleProof(handle)

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
        const [proof, leaf] = getWhitelistProof(address, handle)
        const isWhitelistedLocally = whitelistMerkleTree.verify(proof, leaf, whitelistMerkleRoot)
        expect(isWhitelistedLocally).to.be.true

        // Check user is whitelisted with local merkle root stored on the contract
        const isWhitelistedOnContract = await talentLayerID.isWhitelisted(address, handle, proof)
        expect(isWhitelistedOnContract).to.be.true
      }
    })
  })

  describe('Mint with whitelist enabled', async function () {
    it('Alice cannot mint the handle reserved by Bob', async function () {
      // Get proof for handle 'bob'
      const bob = whitelistedUsers[1]
      const handle = 'bob'
      const handleProof = getHandleProof(handle)
      const [whitelistProof] = getWhitelistProof(bob.address, handle)

      // Alice tries to mint the handle 'bob'
      const tx = talentLayerID
        .connect(alice)
        .whitelistMint(platformId, handle, handleProof, whitelistProof)
      await expect(tx).to.be.revertedWith("You're not whitelisted")
    })

    it('Alice can mint the handle she reserved', async function () {
      const handle = 'alice'
      const handleProof = getHandleProof(handle)
      const [whitelistProof] = getWhitelistProof(alice.address, handle)

      await talentLayerID
        .connect(alice)
        .whitelistMint(platformId, handle, handleProof, whitelistProof)

      // Check profile is minted
      const aliceTlId = await talentLayerID.ids(alice.address)
      const profile = await talentLayerID.getProfile(aliceTlId)
      expect(profile.handle).to.equal(handle)
    })

    it('Eve can mint a non-reserved handle', async function () {
      const eve = nonWhitelistedUsers[0]
      const handle = 'eve'
      const handleProof = getHandleProof(handle)

      // Eve tries to mint the handle 'eve'
      await talentLayerID.connect(eve).whitelistMint(platformId, handle, handleProof, [])

      // Check profile is minted
      const eveTlId = await talentLayerID.ids(eve.address)
      const profile = await talentLayerID.getProfile(eveTlId)
      expect(profile.handle).to.equal(handle)
    })

    it("Can't do regular mint when whitelist is enabled", async function () {
      const frank = nonWhitelistedUsers[1]
      const tx = talentLayerID.connect(frank).mint(platformId, 'frank')
      await expect(tx).to.be.revertedWith('Whitelist must be disabled to use regular mint')
    })
  })

  describe('Mint with whitelist disabled', async function () {
    before(async function () {
      const [deployer] = await ethers.getSigners()
      await talentLayerID.connect(deployer).setWhitelistEnabled(false)
    })

    it("Can't mint with whitelist when it's disabled", async function () {
      const carol = whitelistedUsers[2]
      const handle = 'carol'
      const handleProof = getHandleProof(handle)
      const [whitelistProof] = getWhitelistProof(alice.address, handle)
      const tx = talentLayerID
        .connect(carol)
        .whitelistMint(platformId, 'carol', handleProof, whitelistProof)

      await expect(tx).to.be.revertedWith('Whitelist must be enabled to mint a reserved handle')
    })

    it('Can do regular mint when whitelist is disabled', async function () {
      const frank = nonWhitelistedUsers[1]
      const handle = 'frank'
      await talentLayerID.connect(frank).mint(platformId, handle)

      // Check profile is minted
      const frankTlId = await talentLayerID.ids(frank.address)
      const profile = await talentLayerID.getProfile(frankTlId)
      expect(profile.handle).to.equal(handle)
    })
  })
})
