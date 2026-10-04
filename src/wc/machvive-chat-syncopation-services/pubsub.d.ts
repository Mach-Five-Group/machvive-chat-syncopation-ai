export type Unsubscribe = () => void;

export declare class PubSub {
  /** Subscribe to a topic, or to `'*'` for every topic as `{ topic, payload }`. */
  on(topic: string, handler: (payload: any) => void): Unsubscribe;
  once(topic: string, handler: (payload: any) => void): Unsubscribe;
  emit(topic: string, payload?: unknown): void;
  readonly topics: string[];
}
