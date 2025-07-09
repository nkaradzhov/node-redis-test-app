/**
 * Redis client interface for abstracting different Redis library implementations
 */
export interface IRedisClient {
  /**
   * Connect to Redis server
   */
  connect(): Promise<unknown>;

  /**
   * Disconnect from Redis server
   */
  disconnect(): Promise<unknown>;

  /**
   * Duplicate the Redis client
   */
  duplicate(): Promise<IRedisClient>;

  /**
   * Set a key-value pair
   * @param key - The key to set
   * @param value - The value to set
   * @returns Promise that resolves when the operation is complete
   */
  set(key: string, value: string): Promise<void>;

  /**
   * Get a value by key
   * @param key - The key to get
   * @returns The value or null if not found
   */
  get(key: string): Promise<string | null>;

  /**
   * Increment a numeric value
   * @param key - The key to increment
   * @returns The new value after increment
   */
  incr(key: string): Promise<number>;

  /**
   * Delete a key
   * @param key - The key to delete
   * @returns Number of keys deleted
   */
  del(key: string): Promise<number>;

  /**
   * Add item to a list (left push)
   * @param key - The list key
   * @param values - Values to push
   * @returns The new length of the list
   */
  lpush(key: string, ...values: string[]): Promise<number>;

  /**
   * Get a range of elements from a list
   * @param key - The list key
   * @param start - Start index (0-based)
   * @param stop - Stop index (0-based, -1 for end)
   * @returns Array of elements in the specified range
   */
  lrange(key: string, start: number, stop: number): Promise<string[]>;

  /**
   * Trim a list to the specified range
   * @param key - The list key
   * @param start - Start index (0-based)
   * @param stop - Stop index (0-based, -1 for end)
   * @returns The new length of the list
   */
  ltrim(key: string, start: number, stop: number): Promise<string>;

  /**
   * Publish a message to a channel
   * @param channel - The channel to publish to
   * @param message - The message to publish
   * @returns Number of subscribers that received the message
   */
  publish(channel: string, message: string): Promise<number>;

  /**
   * Subscribe to a channel
   * @param channel - The channel to subscribe to
   * @param callback - Callback function for received messages
   * @returns Promise that resolves when subscription is established
   */
  subscribe(
    channel: string,
    callback: (channel: string, message: string) => void
  ): Promise<void>;

  /**
   * Unsubscribe from channels
   * @param channels - Channels to unsubscribe from (empty array for all)
   * @returns Promise that resolves when unsubscription is complete
   */
  unsubscribe(channels?: string[]): Promise<void>;

  /**
   * Start a transaction (MULTI)
   * @param commands - Array of Redis commands to execute in the transaction
   * @returns Promise that resolves when transaction is started and commands are queued
   */
  multi(commands: { name: string; args: unknown[] }[]): Promise<void>;
}
