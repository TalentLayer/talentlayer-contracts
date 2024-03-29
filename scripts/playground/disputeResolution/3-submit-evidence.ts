import { ethers } from 'hardhat'
import { DeploymentProperty, getDeploymentProperty } from '../../../.deployment/deploymentManager'
import postToIPFS from '../../utils/ipfs'
import { transactionId } from '../constants'

import hre = require('hardhat')

const aliceTlId = 1
const bobTlId = 2

/**
 * In this script, Alice and Bob submit evidence to support their viewpoints on the dispute.
 */
async function main() {
  const network = hre.network.name
  console.log('Network: ', network)

  const [, alice, bob] = await ethers.getSigners()

  const talentLayerEscrow = await ethers.getContractAt(
    'TalentLayerEscrow',
    getDeploymentProperty(network, DeploymentProperty.TalentLayerEscrow),
  )

  // Alice submits evidence
  const aliceEvidence = await postToIPFS(
    JSON.stringify({
      fileURI: '/ipfs/QmWQV5ZFFhEJiW8Lm7ay2zLxC2XS4wx1b2W7FfdrLMyQQc',
      fileHash: 'QmWQV5ZFFhEJiW8Lm7ay2zLxC2XS4wx1b2W7FfdrLMyQQc',
      fileTypeExtension: 'pdf',
      name: 'Email clarifying the terms of the contract',
      description:
        'This is an email sent to from Alice to Bob that clarifies the terms of the contract',
    }),
  )
  await talentLayerEscrow.connect(alice).submitEvidence(aliceTlId, transactionId, aliceEvidence)
  console.log("Alice's evidence submitted")

  // Bob submits evidence
  const bobEvidence = await postToIPFS(
    JSON.stringify({
      fileURI: '/ipfs/QmWQV5ZFFhEJiW8Lm7ay2zLxC2XS4wx1b2W7FfdrLMyQQc',
      fileHash: 'QmWQV5ZFFhEJiW8Lm7ay2zLxC2XS4wx1b2W7FfdrLMyQQc',
      fileTypeExtension: 'pdf',
      name: 'Document that explains the the job that has been done',
      description:
        'This is an email sent from Bob to Alice that shows that the work has been completed according to the terms of the contract',
    }),
  )
  await talentLayerEscrow.connect(bob).submitEvidence(bobTlId, transactionId, bobEvidence)
  console.log("Bob's evidence submitted")
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
