import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'

/*
 * How it works ?
 * 1. get the message hash => 32bytes, 66 caracteres
 * 2. sign the message hash with the private key of the owner of the platform with 'getEthSignedMessageHash' system => 64 bytes, 132 caracteres
 * 3. send signature to the contract
 * 4. the contract rebuild the message hash with same data
 * 5. It transforms the message in "ethSignedMessage"
 * 6. It recovers the address of the signer
 */
export const getSignatureForService = async (
  signer: SignerWithAddress,
  profileId: number,
  nonce: number,
): Promise<string> => {
  const messageHash = ethers.utils.solidityKeccak256(
    ['string', 'uint256', 'uint256'],
    ['createService', profileId, nonce],
  )

  // Carol the owner of the platform signed the message with her private key
  const signature = await signer.signMessage(ethers.utils.arrayify(messageHash))

  return signature
}

export const getSignatureForProposal = async (
  signer: SignerWithAddress,
  profileId: number,
  serviceId: number,
): Promise<string> => {
  // Post a proposal from bob
  const messageHash = ethers.utils.solidityKeccak256(
    ['string', 'uint256', 'uint256'],
    ['createProposal', profileId, serviceId],
  )

  // Carol the owner of the platform signed the message with her private key
  const signature = await signer.signMessage(ethers.utils.arrayify(messageHash))

  return signature
}
