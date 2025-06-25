import { KeyGenerationStrategy, type TKeyGenerationStrategy } from "../common";

/**
 * Combined generator class that handles both key and payload generation
 */
export class KeyAndPayloadGenerator {
  private readonly keyGenerator: (string?: string) => string;

  /**
   * Create a new Generator instance
   * @param keyGenerationStrategy - The strategy to use for key generation (Sequential or Random)
   * @param keyPattern - The key pattern with %d placeholder (e.g., "key-%d", "user-%d")
   * @param keyRangeMin - Minimum value for the key range (inclusive)
   * @param keyRangeMax - Maximum value for the key range (inclusive)
   * @param payloadLength - The length of the payload strings to generate
   */
  constructor(
    private readonly keyGenerationStrategy: TKeyGenerationStrategy,
    private readonly keyPattern: string,
    private readonly keyRangeMin: number,
    private readonly keyRangeMax: number,
    private readonly payloadLength: number
  ) {
    this.keyGenerator = this.createKeyGenerator(
      keyPattern,
      keyRangeMin,
      keyRangeMax
    );
  }

  /**
   * Generate a payload using the configured payload length
   * @returns A generated payload string
   */
  generatePayload(): string {
    const aCharCode = "a".charCodeAt(0);
    const chars = new Array(this.payloadLength);

    for (let i = 0; i < this.payloadLength; i++) {
      // Generate random letter from 'a' to 'z'
      chars[i] = String.fromCharCode(
        aCharCode + Math.floor(Math.random() * 26)
      );
    }

    return chars.join("");
  }

  /**
   * Generate a key using the configured strategy
   * @returns A generated key string
   */
  generateKey(): string {
    return this.keyGenerator();
  }

  /**
   * Creates a key generator function based on the specified strategy
   * @param pattern - The key pattern with %d placeholder (e.g., "key-%d", "user-%d")
   * @param rangeMin - Minimum value for the range (inclusive)
   * @param rangeMax - Maximum value for the range (inclusive)
   * @returns A function that generates keys according to the specified strategy
   */
  private createKeyGenerator(
    pattern: string,
    rangeMin: number,
    rangeMax: number
  ): () => string {
    if (this.keyGenerationStrategy === KeyGenerationStrategy.Sequential) {
      return this.createSequentialKeyGenerator(pattern, rangeMin, rangeMax);
    } else {
      return () => this.generateRandomKey();
    }
  }

  /**
   * Create a sequential key generator function
   * @param pattern - The key pattern with %d placeholder (e.g., "key-%d", "user-%d")
   * @param start - Starting value for the sequence
   * @param max - Maximum value for the sequence (wraps around to start)
   * @returns A function that generates sequential keys
   */
  private createSequentialKeyGenerator(
    pattern = "key-%d",
    start = 0,
    max = 100000
  ): () => string {
    let current = this.keyRangeMin;

    return function nextSequentialKey(): string {
      const key = pattern.replace("%d", current.toString());

      current++;

      if (current > max) {
        current = start; // Wrap around to start
      }

      return key;
    };
  }

  /**
   * Generate a random key using the configured pattern and range
   * @returns A randomly generated key string
   */
  private generateRandomKey(): string {
    const idx =
      Math.floor(Math.random() * (this.keyRangeMax - this.keyRangeMin + 1)) +
      this.keyRangeMin;
    return this.keyPattern.replace("%d", idx.toString());
  }
}
