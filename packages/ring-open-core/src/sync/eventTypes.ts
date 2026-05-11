/** Discriminated event kinds for optional sync layers (informative; extend per deployment). */

export const CALL_EVENT_KINDS = ["call.created", "call.ack", "call.cancelled"] as const;
export type CallEventKind = (typeof CALL_EVENT_KINDS)[number];

export type CallCreatedPayload = {
  kind: "call.created";
  reasons: string[];
  priority: number;
  createdAtMs: number;
};

export type CallAckPayload = {
  kind: "call.ack";
  callId: string;
  acknowledgedAtMs: number;
};

export type CallCancelledPayload = {
  kind: "call.cancelled";
  callId: string;
  cancelledAtMs: number;
};

export type CallEventPayload = CallCreatedPayload | CallAckPayload | CallCancelledPayload;
