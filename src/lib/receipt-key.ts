/**
 * Receipt object keys are issued by the server and scoped to one user and one
 * pledge. Keeping the shape in one pure helper lets both the upload and
 * confirmation endpoints enforce the exact same ownership boundary.
 */

export const RECEIPT_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
] as const;

export type ReceiptContentType = (typeof RECEIPT_CONTENT_TYPES)[number];

const EXTENSION_BY_CONTENT_TYPE: Record<ReceiptContentType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/heic": "heic",
};

export function buildReceiptObjectKey(args: {
  userId: string;
  pledgeId: string;
  contentType: ReceiptContentType;
  timestamp?: number;
}): string {
  const timestamp = args.timestamp ?? Date.now();
  return `${args.userId}/${args.pledgeId}-${timestamp}.${EXTENSION_BY_CONTENT_TYPE[args.contentType]}`;
}

/** True only for keys this server could have issued for this user + pledge. */
export function isReceiptObjectKeyFor(
  objectKey: string,
  userId: string,
  pledgeId: string,
): boolean {
  const prefix = `${userId}/${pledgeId}-`;
  if (!objectKey.startsWith(prefix)) return false;

  const filenameSuffix = objectKey.slice(prefix.length);
  return /^\d{13}\.(?:png|jpg|webp|heic)$/.test(filenameSuffix);
}
