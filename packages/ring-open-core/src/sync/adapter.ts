/**
 * Backend-agnostic sync boundary. Implement with Firestore listeners,
 * Supabase Realtime, MQTT, WebSockets, etc.
 */
export type Unsubscribe = () => void;

export interface RealtimeSyncAdapter<TEvent = unknown> {
  publish(channel: string, event: TEvent): Promise<void>;
  subscribe(channel: string, handler: (event: TEvent) => void): Unsubscribe;
}
