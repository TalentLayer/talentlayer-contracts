export const minTokenWhitelistTransactionAmount = 10
export const cid = 'QmQLVYemsvvqk58y8UTrCEp8MrcQaMzzT2e2duDEmFG99Z'
export const cid2 = 'QmcbtH86xKGM4rNhpzcYMEjGF9qKMQ5Rdep8zfe3ndLtV1'
export const metaEvidenceCid = 'QmQ2hcACF6r2Gf8PDxG4NcBdurzRUopwcaYQHNhSah6a8v'
export const evidenceCid = 'QmNSARUuUMHkFcnSzrCAhmZkmQu7ViK18sPkg48xnbAmv4'
export const now = Math.floor(Date.now() / 1000)
export const proposalExpirationDate = now + 60 * 60 * 24 * 30 // note: as we increase time in several tests, better to be high
export const expiredProposalDate = now - 60 * 60 * 24 * 30
export const feeDivider = 10000
export const arbitrationFeeTimeout = 3600 * 24 * 10
export const ethAddress = '0x0000000000000000000000000000000000000000'

export enum TransactionStatus {
  NoDispute,
  WaitingSender,
  WaitingReceiver,
  DisputeCreated,
  Resolved,
}

export enum DisputeStatus {
  Waiting,
  Appealable,
  Solved,
}

export enum PaymentType {
  Release,
  Reimburse,
}

export enum MintStatus {
  ON_PAUSE,
  ONLY_WHITELIST,
  PUBLIC,
}

export enum ServiceStatus {
  Opened,
  Confirmed,
  Finished,
  Cancelled,
  Uncompleted,
}
