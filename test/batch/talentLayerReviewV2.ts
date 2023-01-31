const { upgrades } = require('hardhat')
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { TalentLayerReview } from '../../typechain-types'
import { deploy } from '../utils/deploy'

/**
 * Deploys contracts and sets up the context for TalentLayerId contract.
 * @returns the deployed contracts
 */
async function deployAndSetup(): Promise<[TalentLayerReview]> {
  const [deployer, alice, bob, carol] = await ethers.getSigners()
  const [talentLayerReview] = await deploy(false)

  return [talentLayerReview]
}

describe('Review V2 migration testing', function () {})
