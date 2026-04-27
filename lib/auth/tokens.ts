import { createHmac, timingSafeEqual } from "node:crypto";

export type AppRole = "nurse" | "family" | "patient";

type SessionPayload = {
  role: AppRole;
  nurseId?: string;
  nurseRole?: "hospital_admin" | "nurse" | "viewer";
  hospitalId?: string;
  hospitalIds?: string[];
  patientId?: string;
  patientName?: string;
  exp: number;
};

type InvitePayload = {
  role: Extract<AppRole, "family" | "patient">;
  hospitalId?: string;
  patientId?: string;
  patientName?: string;
  exp: number;
};

const SESSION_COOKIE = "ring_session";
const SESSION_TTL_SEC = 60 * 60 * 12;
const DEFAULT_INVITE_TTL_SEC = 60 * 60 * 8;

const DEV_FALLBACK_SECRET = "ring-core-dev-only-secret-change-me";

function getSigningSecret(): string {
  return process.env.APP_SIGNING_SECRET?.trim() || DEV_FALLBACK_SECRET;
}

function encodePayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload<T>(value: string): T | null {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

function sign(value: string): string {
  return createHmac("sha256", getSigningSecret()).update(value).digest("base64url");
}

function verifySignature(value: string, sig: string): boolean {
  const expected = sign(value);
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(sig, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function packSignedToken(payload: object): string {
  const encoded = encodePayload(payload);
  const sig = sign(encoded);
  return `${encoded}.${sig}`;
}

function unpackSignedToken<T extends { exp: number }>(token: string): T | null {
  const [encoded, sig] = token.split(".");
  if (!encoded || !sig) return null;
  if (!verifySignature(encoded, sig)) return null;
  const payload = decodePayload<T>(encoded);
  if (!payload) return null;
  if (payload.exp * 1000 <= Date.now()) return null;
  return payload;
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

export function createSessionToken(input: {
  role: AppRole;
  nurseId?: string;
  nurseRole?: "hospital_admin" | "nurse" | "viewer";
  hospitalId?: string;
  hospitalIds?: string[];
  patientId?: string;
  patientName?: string;
  ttlSec?: number;
}): string {
  const ttlSec = input.ttlSec ?? SESSION_TTL_SEC;
  const payload: SessionPayload = {
    role: input.role,
    nurseId: input.nurseId,
    nurseRole: input.nurseRole,
    hospitalId: input.hospitalId,
    hospitalIds: input.hospitalIds,
    patientId: input.patientId,
    patientName: input.patientName,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  return packSignedToken(payload);
}

export function verifySessionToken(token: string): SessionPayload | null {
  return unpackSignedToken<SessionPayload>(token);
}

export function createInviteToken(input: {
  role: Extract<AppRole, "family" | "patient">;
  hospitalId?: string;
  patientId?: string;
  patientName?: string;
  ttlSec?: number;
}): string {
  const ttlSec = input.ttlSec ?? DEFAULT_INVITE_TTL_SEC;
  const payload: InvitePayload = {
    role: input.role,
    hospitalId: input.hospitalId,
    patientId: input.patientId,
    patientName: input.patientName,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  return packSignedToken(payload);
}

export function verifyInviteToken(token: string): InvitePayload | null {
  return unpackSignedToken<InvitePayload>(token);
}
