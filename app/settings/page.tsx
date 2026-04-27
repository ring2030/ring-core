"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Home } from "lucide-react";
import { StaffLinks } from "@/components/dashboard/StaffLinks";
import { TuningPanel } from "@/components/kiyoko/TuningPanel";
import { setEyedidCameraOnTop, getEyedidCameraOnTop } from "@/lib/gaze/eyedidCameraPlacementStorage";
import { getStoredGazeEngine, setStoredGazeEngine, type StoredGazeEngine } from "@/lib/gaze/gazeEngineStorage";
import { getCurrentHospitalIdFromCookie } from "@/lib/auth/clientHospital";
import {
  loadGazeTuning,
  normalizeGazeTuning,
  saveGazeTuning,
  type GazeTuning,
} from "@/lib/gaze/tuning";
import {
  getStoredInputMode,
  setStoredInputMode,
  type NurseInputMode,
} from "@/lib/gaze/inputModeStorage";
import {
  getStoredIrisCameraId,
  setStoredIrisCameraId,
} from "@/lib/gaze/irisCameraStorage";

type NurseAccount = {
  id: string;
  hospitalId: string;
  disabled: boolean;
  role: "hospital_admin" | "nurse" | "viewer";
  mustChangePassword: boolean;
  createdAt: string;
  updatedAt: string;
};

type AuditEvent = {
  at: string;
  actorId: string;
  action: string;
  target: string;
  note?: string;
};

type HospitalSwitchInfo = {
  hospitalId: string;
  hospitalIds: string[];
};

export default function SettingsPage() {
  const [inputMode, setInputMode] = useState<NurseInputMode>(() => getStoredInputMode());
  const [gazeEngine, setGazeEngine] = useState<StoredGazeEngine>(() => getStoredGazeEngine());
  const [gazeTuning, setGazeTuning] = useState<GazeTuning>(() => loadGazeTuning());
  const [eyedidCamTop, setEyedidCamTop] = useState<boolean | null>(() => getEyedidCameraOnTop());
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [irisCamId, setIrisCamId] = useState<string | undefined>(() => getStoredIrisCameraId());
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [hospitalId, setHospitalId] = useState<string>("");
  const [accounts, setAccounts] = useState<NurseAccount[]>([]);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"hospital_admin" | "nurse" | "viewer">("nurse");
  const [assignHospitalByUser, setAssignHospitalByUser] = useState<Record<string, string>>({});
  const [accountBusy, setAccountBusy] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [hospitalChoices, setHospitalChoices] = useState<string[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");

  useEffect(() => {
    setHospitalId(getCurrentHospitalIdFromCookie());
  }, []);

  const loadAccounts = useCallback(async () => {
    const res = await fetch("/api/nurse-accounts");
    const data = (await res.json()) as {
      ok: boolean;
      accounts?: NurseAccount[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Could not load staff accounts.");
    }
    setAccounts(data.accounts ?? []);
  }, []);

  const loadAuditLogs = useCallback(async () => {
    const res = await fetch("/api/audit-logs");
    const data = (await res.json()) as {
      ok: boolean;
      events?: AuditEvent[];
      error?: string;
    };
    if (!res.ok || !data.ok) {
      throw new Error(data.error ?? "Could not load audit logs.");
    }
    setAuditEvents(data.events ?? []);
  }, []);

  const loadHospitalSwitchInfo = useCallback(async () => {
    const res = await fetch("/api/auth/hospital-switch");
    const data = (await res.json()) as { ok: boolean; error?: string } & Partial<HospitalSwitchInfo>;
    if (!res.ok || !data.ok || !data.hospitalId) {
      throw new Error(data.error ?? "Could not load hospital memberships.");
    }
    const ids = data.hospitalIds ?? [data.hospitalId];
    setHospitalChoices(ids);
    setSelectedHospitalId(data.hospitalId);
    setHospitalId(data.hospitalId);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await Promise.all([loadHospitalSwitchInfo(), loadAccounts(), loadAuditLogs()]);
        setAccountError(null);
      } catch (error: unknown) {
        setAccountError(error instanceof Error ? error.message : "Could not load staff data.");
      }
    })();
  }, [loadAccounts, loadAuditLogs, loadHospitalSwitchInfo]);

  const createAccount = async () => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/nurse-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: newId, password: newPassword, role: newRole }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not create account.");
      setNewId("");
      setNewPassword("");
      setNewRole("nurse");
      await Promise.all([loadAccounts(), loadAuditLogs()]);
    } catch (error: unknown) {
      setAccountError(error instanceof Error ? error.message : "Could not create account.");
    } finally {
      setAccountBusy(false);
    }
  };

  const toggleDisabled = async (id: string, disabled: boolean) => {
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/nurse-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, disabled }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not update account.");
      await Promise.all([loadAccounts(), loadAuditLogs()]);
    } catch (error: unknown) {
      setAccountError(error instanceof Error ? error.message : "Could not update account.");
    } finally {
      setAccountBusy(false);
    }
  };

  const assignHospitalMembership = async (id: string) => {
    const target = (assignHospitalByUser[id] ?? "").trim();
    if (!target) {
      setAccountError("Enter a target hospital ID first.");
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/nurse-accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, assignHospitalId: target }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Could not assign hospital.");
      setAssignHospitalByUser((prev) => ({ ...prev, [id]: "" }));
      await Promise.all([loadAccounts(), loadAuditLogs(), loadHospitalSwitchInfo()]);
    } catch (error: unknown) {
      setAccountError(error instanceof Error ? error.message : "Could not assign hospital.");
    } finally {
      setAccountBusy(false);
    }
  };

  const switchHospital = async () => {
    if (!selectedHospitalId || selectedHospitalId === hospitalId) return;
    setAccountBusy(true);
    setAccountError(null);
    try {
      const res = await fetch("/api/auth/hospital-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hospitalId: selectedHospitalId }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        hospitalId?: string;
        hospitalIds?: string[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.hospitalId) {
        throw new Error(data.error ?? "Could not switch hospital.");
      }
      setHospitalId(data.hospitalId);
      setHospitalChoices(data.hospitalIds ?? [data.hospitalId]);
      await Promise.all([loadAccounts(), loadAuditLogs()]);
    } catch (error: unknown) {
      setAccountError(error instanceof Error ? error.message : "Could not switch hospital.");
    } finally {
      setAccountBusy(false);
    }
  };

  useEffect(() => {
    saveGazeTuning(gazeTuning);
  }, [gazeTuning]);

  const refreshDevices = useCallback(async () => {
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      const list = await navigator.mediaDevices.enumerateDevices();
      setVideoInputs(list.filter((d) => d.kind === "videoinput"));
    } catch {
      setMediaError("Could not list cameras. Allow camera access in the browser.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true })
      .then((stream) => {
        stream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((list) => {
        if (cancelled) return;
        setVideoInputs(list.filter((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        if (cancelled) return;
        setMediaError("Could not list cameras. Allow camera access in the browser.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const applyInputMode = (mode: NurseInputMode) => {
    setStoredInputMode(mode);
    setInputMode(mode);
  };

  const applyEngine = (engine: StoredGazeEngine) => {
    setStoredGazeEngine(engine);
    setGazeEngine(engine);
  };

  const applyEyedidPlacement = (onTop: boolean) => {
    setEyedidCameraOnTop(onTop);
    setEyedidCamTop(onTop);
  };

  const applyIrisCamera = (id: string) => {
    setStoredIrisCameraId(id);
    setIrisCamId(id);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-100 to-slate-200/90 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
              Home
            </Link>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-800 sm:text-xl">
            Settings
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">How you interact</h2>
          <p className="mt-1 text-sm text-slate-600">
            These options apply on the home screen.
          </p>
          <div
            className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1"
            role="tablist"
            aria-label="Input mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "eyedid"}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition sm:text-base ${
                inputMode === "eyedid"
                  ? "bg-white text-cyan-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => applyInputMode("eyedid")}
            >
              Gaze
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={inputMode === "pointer"}
              className={`flex-1 rounded-xl py-3 text-sm font-bold transition sm:text-base ${
                inputMode === "pointer"
                  ? "bg-white text-violet-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
              onClick={() => applyInputMode("pointer")}
            >
              Touch / mouse
            </button>
          </div>
        </section>

        {inputMode === "eyedid" && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-base font-bold text-slate-900">Gaze engine</h2>
            <p className="mt-1 text-sm text-slate-600">
              Iris tracking works for most setups. Eyedid needs its own license.
            </p>
            <div className="mt-4 flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                  gazeEngine === "iris"
                    ? "bg-white text-emerald-700 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => applyEngine("iris")}
              >
                Iris
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                  gazeEngine === "eyedid"
                    ? "bg-white text-cyan-800 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                onClick={() => applyEngine("eyedid")}
              >
                Eyedid
              </button>
            </div>

            {gazeEngine === "iris" && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h3 className="text-sm font-bold text-slate-800">Camera (iris)</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Pick a device only if you have more than one.
                </p>
                {mediaError && (
                  <p className="mt-2 text-sm text-red-600" role="alert">
                    {mediaError}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshDevices()}
                    className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Refresh list
                  </button>
                </div>
                <ul className="mt-3 space-y-2">
                  {videoInputs.map((d) => (
                    <li key={d.deviceId}>
                      <button
                        type="button"
                        onClick={() => applyIrisCamera(d.deviceId)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition ${
                          irisCamId === d.deviceId ||
                          (!irisCamId && videoInputs[0]?.deviceId === d.deviceId)
                            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        {d.label || `Camera ${d.deviceId.slice(0, 8)}…`}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {gazeEngine === "eyedid" && (
              <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Camera position (Eyedid)</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Match whether the built-in camera is above or below the display. Return home to apply.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => applyEyedidPlacement(true)}
                      className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
                        eyedidCamTop === true
                          ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      Above display
                    </button>
                    <button
                      type="button"
                      onClick={() => applyEyedidPlacement(false)}
                      className={`min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-bold ${
                        eyedidCamTop === false
                          ? "border-cyan-500 bg-cyan-50 text-cyan-900"
                          : "border-slate-200 bg-white hover:bg-slate-50"
                      }`}
                    >
                      Below display
                    </button>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Recalibrate gaze</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    Run Eyedid calibration again from home.
                  </p>
                  <Link
                    href="/?recalibrate=1"
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-bold text-white shadow hover:bg-slate-700"
                  >
                    Open recalibration on home
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {(inputMode === "pointer" ||
          (inputMode === "eyedid" && gazeEngine === "eyedid")) && (
          <section className="rounded-2xl border border-slate-200/80 bg-white p-0 shadow-sm sm:p-0">
            <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
              <h2 className="text-base font-bold text-slate-900">Left / right sensitivity</h2>
              <p className="mt-1 text-sm text-slate-600">
                Width for Restroom vs Chat targets. Not used in iris mode.
              </p>
            </div>
            <div className="p-5 sm:p-6">
              <TuningPanel
                embedded
                gazeTuning={gazeTuning}
                onTuningChange={(t) => setGazeTuning(normalizeGazeTuning(t))}
                onClose={() => {}}
              />
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">Staff & family</h2>
          <p className="mt-1 text-sm text-slate-600">
            Open the log and nurse views from here.
          </p>
          <div className="mt-4">
            <StaffLinks className="gap-2" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">Hospital scope (PoC)</h2>
          <p className="mt-1 text-sm text-slate-600">
            Current hospital: <code>{hospitalId || "loading..."}</code>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={selectedHospitalId}
              onChange={(e) => setSelectedHospitalId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              disabled={accountBusy}
            >
              {hospitalChoices.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void switchHospital()}
              disabled={accountBusy || !selectedHospitalId || selectedHospitalId === hospitalId}
              className="rounded-xl bg-slate-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Switch hospital
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Demo login <code>1/1</code> keeps existing data behavior while enabling hospital separation.
          </p>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">Nurse accounts (this hospital)</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="New login ID"
            />
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="New password"
              type="password"
            />
            <select
              value={newRole}
              onChange={(e) =>
                setNewRole(e.target.value as "hospital_admin" | "nurse" | "viewer")
              }
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="nurse">nurse</option>
              <option value="hospital_admin">hospital_admin</option>
              <option value="viewer">viewer</option>
            </select>
            <button
              type="button"
              onClick={() => void createAccount()}
              disabled={accountBusy}
              className="rounded-xl bg-cyan-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              Create account
            </button>
          </div>
          {accountError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {accountError}
            </p>
          )}
          <ul className="mt-4 space-y-2">
            {accounts.map((account) => (
              <li
                key={`${account.hospitalId}:${account.id}`}
                className="rounded-xl border border-slate-200 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {account.id} <span className="text-xs font-normal text-slate-500">({account.role})</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated {new Date(account.updatedAt).toLocaleString()}
                    </p>
                    {account.mustChangePassword && (
                      <p className="text-xs text-amber-700">Must change password on next sign-in</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void toggleDisabled(account.id, !account.disabled)}
                      disabled={accountBusy}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold text-white ${
                        account.disabled ? "bg-emerald-600" : "bg-slate-600"
                      }`}
                    >
                      {account.disabled ? "Enable" : "Disable"}
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2">
                  <input
                    value={assignHospitalByUser[account.id] ?? ""}
                    onChange={(e) =>
                      setAssignHospitalByUser((prev) => ({
                        ...prev,
                        [account.id]: e.target.value,
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                    placeholder="target hospital id"
                  />
                  <button
                    type="button"
                    onClick={() => void assignHospitalMembership(account.id)}
                    disabled={accountBusy}
                    className="rounded-lg border border-cyan-300 bg-cyan-50 px-2.5 py-1.5 text-xs font-bold text-cyan-800 disabled:opacity-60"
                  >
                    Add membership
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-base font-bold text-slate-900">Audit log (simple)</h2>
          <div className="mt-1 flex items-center justify-between gap-2">
            <p className="text-sm text-slate-600">
            Recent actions in this hospital.
            </p>
            <a
              href="/api/audit-logs/export"
              className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download CSV
            </a>
          </div>
          <ul className="mt-4 space-y-2">
            {auditEvents.map((event, idx) => (
              <li key={`${event.at}-${idx}`} className="rounded-xl border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</p>
                <p className="text-sm font-semibold text-slate-800">
                  {event.actorId} - {event.action} - {event.target}
                </p>
                {event.note && <p className="text-xs text-slate-600">{event.note}</p>}
              </li>
            ))}
            {auditEvents.length === 0 && (
              <li className="text-sm text-slate-500">No logs yet.</li>
            )}
          </ul>
        </section>

        <p className="pb-8 text-center text-xs text-slate-500">
          <Link href="/" className="inline-flex items-center gap-1 font-medium text-cyan-700 hover:underline">
            <Home className="size-3.5" aria-hidden />
            Kiyoko home
          </Link>
        </p>
      </main>
    </div>
  );
}
