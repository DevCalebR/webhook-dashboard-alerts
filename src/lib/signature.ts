import crypto from "node:crypto";

export interface SignatureCheckResult {
  valid: boolean;
  reason?: string;
}

function normalizeHex(input: string): string {
  return input.trim().toLowerCase().replace(/^sha256=/, "");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const left = Buffer.from(normalizeHex(a), "hex");
  const right = Buffer.from(normalizeHex(b), "hex");

  if (left.length === 0 || right.length === 0 || left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function computeRawBodyHash(rawBody: string): string {
  return sha256Hex(rawBody);
}

export function createGenericSignature(rawBody: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
}

export function verifyGenericSignature(
  rawBody: string,
  providedSignature: string,
  secret: string,
): SignatureCheckResult {
  if (!providedSignature) {
    return { valid: false, reason: "missing_signature" };
  }

  const expected = createGenericSignature(rawBody, secret);
  const valid = timingSafeEqualHex(expected, providedSignature);

  return {
    valid,
    reason: valid ? undefined : "signature_mismatch",
  };
}

interface ParsedStripeLikeHeader {
  timestamp: number;
  signatures: string[];
}

function parseStripeLikeHeader(header: string): ParsedStripeLikeHeader | null {
  const parts = header.split(",").map((part) => part.trim());

  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (!key || !value) {
      continue;
    }

    if (key === "t") {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isNaN(parsed)) {
        timestamp = parsed;
      }
    }

    if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    return null;
  }

  return { timestamp, signatures };
}

export function createStripeLikeSignature(
  rawBody: string,
  secret: string,
  timestamp: number,
): string {
  const signedPayload = `${timestamp}.${rawBody}`;
  return crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
}

export function createStripeLikeHeader(
  rawBody: string,
  secret: string,
  timestamp = Math.floor(Date.now() / 1000),
): string {
  const signature = createStripeLikeSignature(rawBody, secret, timestamp);
  return `t=${timestamp},v1=${signature}`;
}

export function verifyStripeLikeSignature(
  rawBody: string,
  headerValue: string,
  secret: string,
  toleranceSeconds = 300,
  nowInSeconds = Math.floor(Date.now() / 1000),
): SignatureCheckResult {
  if (!headerValue) {
    return { valid: false, reason: "missing_signature" };
  }

  const parsed = parseStripeLikeHeader(headerValue);
  if (!parsed) {
    return { valid: false, reason: "invalid_header" };
  }

  const timestampDelta = Math.abs(nowInSeconds - parsed.timestamp);
  if (timestampDelta > toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = createStripeLikeSignature(rawBody, secret, parsed.timestamp);
  const valid = parsed.signatures.some((signature) =>
    timingSafeEqualHex(expected, signature),
  );

  return {
    valid,
    reason: valid ? undefined : "signature_mismatch",
  };
}
