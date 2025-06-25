import { describe, it } from "node:test";
import assert from "node:assert";
import { KeyAndPayloadGenerator } from "./key-and-payload-generator";
import { KeyGenerationStrategy } from "../common/config/app-config";

describe("KeyAndPayloadGenerator", () => {
  describe("generatePayload", () => {
    it("should generate payload with correct length", () => {
      const payloadLength = 15;
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "key-%d",
        1,
        100,
        payloadLength
      );

      const payload = generator.generatePayload();

      assert.strictEqual(payload.length, payloadLength);
    });

    it("should generate payload with only lowercase letters", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "key-%d",
        1,
        100,
        20
      );

      const payload = generator.generatePayload();

      // Check that all characters are lowercase letters a-z
      const isValidPayload = /^[a-z]+$/.test(payload);
      assert.strictEqual(isValidPayload, true);
    });

    it("should generate different payloads on multiple calls", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "key-%d",
        1,
        100,
        50
      );

      const payload1 = generator.generatePayload();
      const payload2 = generator.generatePayload();

      // With 50 characters, it's extremely unlikely they'll be identical
      assert.notStrictEqual(payload1, payload2);
    });
  });

  describe("generateKey - Random strategy", () => {
    it("should generate key with correct pattern", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "user-%d",
        10,
        20,
        5
      );

      const key = generator.generateKey();

      // Should match pattern user-{number} where number is between 10-20
      const match = key.match(/^user-(\d+)$/);
      assert.ok(match?.[1], `Key "${key}" should match pattern user-{number}`);

      const number = parseInt(match[1], 10);
      assert.ok(
        number >= 10 && number <= 20,
        `Number ${number} should be between 10-20`
      );
    });

    it("should generate keys within specified range", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "test-%d",
        5,
        5, // Same min and max should always generate same number
        10
      );

      const key = generator.generateKey();

      assert.strictEqual(key, "test-5");
    });
  });

  describe("generateKey - Sequential strategy", () => {
    it("should generate sequential keys starting from min", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Sequential,
        "seq-%d",
        100,
        102,
        5
      );

      const key1 = generator.generateKey();
      const key2 = generator.generateKey();
      const key3 = generator.generateKey();

      assert.strictEqual(key1, "seq-100");
      assert.strictEqual(key2, "seq-101");
      assert.strictEqual(key3, "seq-102");
    });

    it("should wrap around when reaching max", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Sequential,
        "wrap-%d",
        1,
        2,
        5
      );

      const key1 = generator.generateKey();
      const key2 = generator.generateKey();
      const key3 = generator.generateKey(); // Should wrap to start

      assert.strictEqual(key1, "wrap-1");
      assert.strictEqual(key2, "wrap-2");
      assert.strictEqual(key3, "wrap-1");
    });
  });

  describe("edge cases", () => {
    it("should handle zero-length payload", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "key-%d",
        1,
        100,
        0
      );

      const payload = generator.generatePayload();

      assert.strictEqual(payload, "");
    });

    it("should handle single character range for keys", () => {
      const generator = new KeyAndPayloadGenerator(
        KeyGenerationStrategy.Random,
        "single-%d",
        42,
        42,
        5
      );

      const key = generator.generateKey();

      assert.strictEqual(key, "single-42");
    });
  });
});
