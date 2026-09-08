import { describe, expect, it } from "vitest";
import {
  FILE_FINGERPRINT_NOTICE,
  fingerprintFile,
  fingerprintResult,
  MAX_FINGERPRINT_FILE_BYTES,
  normalizeSHA256,
  validateFingerprintFile,
} from "@/utils/fileFingerprints";

describe("file fingerprint verification", () => {
  it("calculates actual SHA-256, including an empty file", async () => {
    expect(await fingerprintFile(new File(["abc"], "print.dat"))).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(await fingerprintFile(new File([], "empty.bin"))).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
  it("normalizes valid reference hashes and rejects malformed values", () => {
    expect(normalizeSHA256(" A".trim().repeat(64))).toBe("a".repeat(64));
    expect(normalizeSHA256(`  ${"AB".repeat(32)}  `)).toBe("ab".repeat(32));
    for (const value of [
      "",
      "abc",
      "g".repeat(64),
      "0x" + "a".repeat(64),
      "a".repeat(65),
    ])
      expect(normalizeSHA256(value)).toBeNull();
  });
  it("compares bytes, not filenames or human identity", async () => {
    const file = new File(["same content"], "first.png"),
      other = new File(["same content"], "different.pdf");
    const hash = await fingerprintFile(file);
    expect(
      fingerprintResult(file, hash, await fingerprintFile(other)).matches,
    ).toBe(true);
    expect(
      fingerprintResult(
        file,
        hash,
        await fingerprintFile(new File(["changed"], "first.png")),
      ).matches,
    ).toBe(false);
    expect(fingerprintResult(file, hash).matches).toBeNull();
    expect(fingerprintResult(file, hash)).not.toHaveProperty("contents");
    expect(FILE_FINGERPRINT_NOTICE).toContain("does not identify a person");
    expect(() => fingerprintResult(file, hash, "invalid")).toThrow(
      "64 hexadecimal",
    );
  });
  it("bounds file sizes before reading bytes", () => {
    expect(() =>
      validateFingerprintFile({ size: MAX_FINGERPRINT_FILE_BYTES }),
    ).not.toThrow();
    expect(() =>
      validateFingerprintFile({ size: MAX_FINGERPRINT_FILE_BYTES + 1 }),
    ).toThrow("25 MB");
  });
});
