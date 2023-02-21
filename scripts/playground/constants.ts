import { BigNumber, Bytes } from 'ethers'

export const transactionId = 0
export const transactionAmount = BigNumber.from(1000)
export const arbitratorExtraData: Bytes = []
export const arbitrationCost = BigNumber.from(10)
export const disputeId = 0
export const arbitrationFeeTimeout = 3600 * 24 * 30
export const rulingId = 1
export const cid = 'QmQLVYemsvvqk58y8UTrCEp8MrcQaMzzT2e2duDEmFG99Z'
export const metaEvidenceCid = 'QmQ2hcACF6r2Gf8PDxG4NcBdurzRUopwcaYQHNhSah6a8v'
export const now = Math.floor(Date.now() / 1000)
export const proposalExpirationDate = now + 60 * 60 * 24 * 15
