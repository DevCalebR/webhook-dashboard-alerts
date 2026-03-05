import { describe, expect, it } from "vitest";

import {
  createGenericSignature,
  createStripeLikeHeader,
  verifyGenericSignature,
  verifyStripeLikeSignature,
} from "@/lib/signature";

describe("verifyGenericSignature", () => {
  it("accepts a valid signature", () => {
    const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const secret = "generic_secret";
    const signature = createGenericSignature(body, secret);

    const result = verifyGenericSignature(body, signature, secret);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("rejects a tampered signature", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const result = verifyGenericSignature(body, "bad", "generic_secret");

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("signature_mismatch");
  });
});

describe("verifyStripeLikeSignature", () => {
  it("accepts a valid stripe-like signature", () => {
    const body = JSON.stringify({ id: "evt_2", type: "charge.succeeded" });
    const secret = "stripe_secret";
    const timestamp = 1_700_000_000;
    const header = createStripeLikeHeader(body, secret, timestamp);

    const result = verifyStripeLikeSignature(body, header, secret, 300, timestamp + 60);

    expect(result.valid).toBe(true);
  });

  it("rejects signatures outside tolerance", () => {
    const body = JSON.stringify({ id: "evt_3" });
    const secret = "stripe_secret";
    const timestamp = 1_700_000_000;
    const header = createStripeLikeHeader(body, secret, timestamp);

    const result = verifyStripeLikeSignature(body, header, secret, 30, timestamp + 120);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe("timestamp_out_of_tolerance");
  });
});
