import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import keccak256 from 'keccak256'
import MerkleTree from 'merkletreejs'
import { TalentLayerID } from '../../typechain-types'
import { MintStatus } from '../utils/constant'
import { deploy } from '../utils/deploy'

const platformId = 1
const reservedHandles = ['alice', 'bob', 'carol']

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<
  [TalentLayerID, SignerWithAddress[], SignerWithAddress[], MerkleTree, string]
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

  // Deployer mints Platform Id for Dave
  await talentLayerPlatformID.connect(deployer).whitelistUser(deployer.address)

  const platformName = 'hirevibes'
  await talentLayerPlatformID.connect(deployer).mintForAddress(platformName, dave.address)

  return [
    talentLayerID,
    whitelistedUsers,
    nonWhitelistedUsers,
    whitelistMerkleTree,
    whitelistMerkleRoot,
  ]
}

describe('Whitelist to mint reserved handles', function () {
  let talentLayerID: TalentLayerID,
    whitelistedUsers: SignerWithAddress[],
    nonWhitelistedUsers: SignerWithAddress[],
    whitelistMerkleTree: MerkleTree,
    whitelistMerkleRoot: string,
    alice: SignerWithAddress,
    bob: SignerWithAddress,
    carol: SignerWithAddress

  before(async function () {
    ;[
      talentLayerID,
      whitelistedUsers,
      nonWhitelistedUsers,
      whitelistMerkleTree,
      whitelistMerkleRoot,
    ] = await deployAndSetup()

    alice = whitelistedUsers[0]
    bob = whitelistedUsers[1]
    carol = whitelistedUsers[2]
  })

  function getWhitelistProof(address: string, handle: string): [string[], Buffer] {
    const whitelistEntry = `${address.toLocaleLowerCase()};${handle}`
    const leaf = keccak256(whitelistEntry)
    const proof = whitelistMerkleTree.getHexProof(leaf)
    return [proof, leaf]
  }

  describe('Whitelist', async function () {
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
      const handle = 'bob'
      const [whitelistProof] = getWhitelistProof(bob.address, handle)

      // Alice (who is whitelisted) tries to mint the handle 'bob', reserved by Bob
      const tx = talentLayerID.connect(alice).whitelistMint(platformId, handle, whitelistProof)
      await expect(tx).to.be.revertedWith("You're not whitelisted")
    })

    it('Eve cannot mint a non-reserved handle', async function () {
      // Eve (who is not whitelisted) tries to mint a non-reserved handle
      const eve = nonWhitelistedUsers[0]
      const handle = 'eve'
      const [eveProof] = getWhitelistProof(eve.address, handle)

      const tx = talentLayerID.connect(eve).whitelistMint(platformId, handle, eveProof)
      await expect(tx).to.be.revertedWith("You're not whitelisted")

      // Eve (who is not whitelisted) tries to mint a non-reserved handle, using the proof for a reserved handle
      const [carolProof] = getWhitelistProof(carol.address, 'carol')
      const tx2 = talentLayerID.connect(eve).whitelistMint(platformId, 'eve', carolProof)
      await expect(tx2).to.be.revertedWith("You're not whitelisted")
    })

    it('Alice can mint the handle she reserved', async function () {
      const handle = 'alice'
      const [whitelistProof] = getWhitelistProof(alice.address, handle)

      await talentLayerID.connect(alice).whitelistMint(platformId, handle, whitelistProof)

      // Check profile is minted
      const aliceTlId = await talentLayerID.ids(alice.address)
      const profile = await talentLayerID.getProfile(aliceTlId)
      expect(profile.handle).to.equal(handle)
    })

    it("Can't do regular mint when whitelist is enabled", async function () {
      const frank = nonWhitelistedUsers[1]
      const tx = talentLayerID.connect(frank).mint(platformId, 'frank')
      await expect(tx).to.be.revertedWith('Public mint is not enabled')
    })
  })

  describe('Mint with whitelist disabled', async function () {
    before(async function () {
      const [deployer] = await ethers.getSigners()
      await talentLayerID.connect(deployer).updateMintStatus(MintStatus.PUBLIC)
    })

    it("Can't mint with whitelist when it's disabled", async function () {
      const handle = 'carol'
      const [whitelistProof] = getWhitelistProof(alice.address, handle)
      const tx = talentLayerID.connect(carol).whitelistMint(platformId, 'carol', whitelistProof)

      await expect(tx).to.be.revertedWith('Whitelist mint is not enabled')
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
