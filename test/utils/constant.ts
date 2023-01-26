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