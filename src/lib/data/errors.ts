export class IdempotencyConflictError extends Error {
  constructor() {
    super("An idempotency key was reused for different pledge details.");
    this.name = "IdempotencyConflictError";
  }
}

export class ReceiptEvidenceReuseError extends Error {
  constructor() {
    super("That receipt evidence is already attached to another contribution.");
    this.name = "ReceiptEvidenceReuseError";
  }
}

export class ReceiptVerificationRequiredError extends Error {
  constructor() {
    super("A matching AI-reviewed receipt is required to confirm a contribution.");
    this.name = "ReceiptVerificationRequiredError";
  }
}
