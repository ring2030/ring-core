import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";

type ServiceAccountLike = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function normalizePrivateKey(value: string | undefined): string | undefined {
  return value?.replace(/\\n/g, "\n");
}

function parseServiceAccountJson(rawJson: string): ServiceAccountLike {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. " +
        "Expected a single-line JSON service-account object (do not include the contents on disk).",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON must be a JSON object with projectId/clientEmail/privateKey.",
    );
  }
  const obj = parsed as Record<string, unknown>;
  const projectId =
    typeof obj["projectId"] === "string"
      ? obj["projectId"]
      : typeof obj["project_id"] === "string"
        ? (obj["project_id"] as string)
        : undefined;
  const clientEmail =
    typeof obj["clientEmail"] === "string"
      ? obj["clientEmail"]
      : typeof obj["client_email"] === "string"
        ? (obj["client_email"] as string)
        : undefined;
  const privateKeyRaw =
    typeof obj["privateKey"] === "string"
      ? obj["privateKey"]
      : typeof obj["private_key"] === "string"
        ? (obj["private_key"] as string)
        : undefined;
  const privateKey = normalizePrivateKey(privateKeyRaw);
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON is missing required fields (projectId, clientEmail, privateKey).",
    );
  }
  return { projectId, clientEmail, privateKey };
}

function resolveServiceAccountFromEnv(): ServiceAccountLike | null {
  const rawJson = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]?.trim();
  if (rawJson) {
    return parseServiceAccountJson(rawJson);
  }
  const projectId = process.env["FIREBASE_ADMIN_PROJECT_ID"]?.trim();
  const clientEmail = process.env["FIREBASE_ADMIN_CLIENT_EMAIL"]?.trim();
  const privateKey = normalizePrivateKey(process.env["FIREBASE_ADMIN_PRIVATE_KEY"]?.trim());
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }
  return null;
}

export function getFirebaseAdminDb(): Firestore {
  if (getApps().length === 0) {
    const serviceAccount = resolveServiceAccountFromEnv();
    if (serviceAccount) {
      initializeApp({
        credential: cert({
          projectId: serviceAccount.projectId,
          clientEmail: serviceAccount.clientEmail,
          privateKey: serviceAccount.privateKey,
        }),
      });
    } else if (!isProduction()) {
      // Dev/test only: try Application Default Credentials so local emulators or
      // gcloud-authenticated developers can still exercise the code paths.
      const projectId = process.env["NEXT_PUBLIC_FIREBASE_PROJECT_ID"]?.trim();
      initializeApp({
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {}),
      });
    } else {
      throw new Error(
        "Firebase Admin credentials are required in production. " +
          "Set FIREBASE_SERVICE_ACCOUNT_JSON (preferred) or " +
          "FIREBASE_ADMIN_PROJECT_ID + FIREBASE_ADMIN_CLIENT_EMAIL + FIREBASE_ADMIN_PRIVATE_KEY.",
      );
    }
  }
  return getAdminFirestore();
}
