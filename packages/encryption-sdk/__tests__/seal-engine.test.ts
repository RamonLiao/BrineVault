import { describe, it, expect } from "vitest";
import { ENCRYPTION_SCHEMES } from "@rwa-dataroom/shared";
import { SealEngine, generateAESKey } from "../src/index.js";

describe("SealEngine (Phase 1 stub)", () => {
  const engine = new SealEngine();

  it("has correct scheme", () => {
    expect(engine.scheme).toBe(ENCRYPTION_SCHEMES.SEAL);
  });

  it("encrypt throws 'not yet available'", async () => {
    const key = await generateAESKey();
    const plaintext = new Uint8Array(10).buffer;
    await expect(engine.encrypt(plaintext, key)).rejects.toThrow(
      "Seal engine not yet available",
    );
  });

  it("decrypt throws 'not yet available'", async () => {
    const key = await generateAESKey();
    const blob = {
      data: new Uint8Array(32),
      scheme: ENCRYPTION_SCHEMES.SEAL,
    };
    await expect(engine.decrypt(blob, key)).rejects.toThrow(
      "Seal engine not yet available",
    );
  });
});
