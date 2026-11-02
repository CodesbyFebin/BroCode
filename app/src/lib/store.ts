import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSession, createInitialSession, SAMPLE_CRON } from "@/lib/agent/seed";
import { DEFAULT_SETTINGS } from "@/lib/agent/providers";
import { idleSwarm } from "@/lib/agent/swarm";
import type {
  ActivityId,
  AppMode,
  CronJob,
  MemoryEntry,
  MobileTab,
  SettingsState,
  SwarmState,
  WorkSession,
} from "@/lib/agent/types";
import { safePath, uid } from "@/lib/utils";

const MAX_MESSAGES = 80;
const MAX_MEMORIES = 80;
const MAX_SNAPSHOTS = 8;

type WorkState = {
  sessions: WorkSession[];
  currentId: string;
  settings: SettingsState;
  activity: ActivityId;
  mobileTab: MobileTab;
  appMode: AppMode;
  cronJobs: CronJob[];
  xaiReady: boolean | null;
  setXaiReady: (v: boolean) => void;
  setActivity: (id: ActivityId) => void;
  setMobileTab: (id: MobileTab) => void;
  setAppMode: (mode: AppMode) => void;
  patchSettings: (p: Partial<SettingsState>) => void;
  setKey: (providerId: string, key: string) => void;
  current: () => WorkSession;
  newSession: (title?: string) => string;
  switchSession: (id: string) => void;
  renameSession: (id: string, title: string) => void;
  deleteSession: (id: string) => void;
  patchCurrent: (fn: (s: WorkSession) => WorkSession) => void;
  upsertFile: (path: string, content: string) => void;
  deleteFile: (path: string) => void;
  openTab: (path: string) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string | null) => void;
  addMemory: (entry: Omit<MemoryEntry, "id" | "createdAt" | "strength"> & { strength?: number }) => void;
  deleteMemory: (id: string) => void;
  setSwarm: (swarm: SwarmState) => void;
  snapshotFiles: () => void;
  undoFiles: () => void;
  applyPending: () => void;
  rejectPending: () => void;
  addCron: (job: Omit<CronJob, "id">) => void;
  patchCron: (id: string, p: Partial<CronJob>) => void;
  deleteCron: (id: string) => void;
};

function clampSession(s: WorkSession): WorkSession {
  return {
    ...s,
    messages: s.messages.slice(-MAX_MESSAGES),
    memories: s.memories.slice(-MAX_MEMORIES),
    snapshots: s.snapshots.slice(-MAX_SNAPSHOTS),
    pending: s.pending ?? [],
    updatedAt: Date.now(),
  };
}

function migrateSession(s: WorkSession): WorkSession {
  const updatedAt = s.updatedAt > 10_000 ? s.updatedAt : Date.now();
  const createdAt = s.createdAt > 10_000 ? s.createdAt : updatedAt;
  return { ...s, pending: s.pending ?? [], updatedAt, createdAt };
}

const first = createInitialSession();

export const useWork = create<WorkState>()(
  persist(
    (set, get) => ({
      sessions: [first],
      currentId: first.id,
      settings: DEFAULT_SETTINGS,
      activity: "home",
      mobileTab: "home",
      appMode: "work",
      cronJobs: SAMPLE_CRON,
      xaiReady: null,
      setXaiReady: (v) => set({ xaiReady: v }),
      setActivity: (activity) => set({ activity }),
      setMobileTab: (mobileTab) => set({ mobileTab }),
      setAppMode: (appMode) =>
        set({
          appMode,
          activity: appMode === "chat" ? "home" : "home",
          mobileTab: appMode === "chat" ? "task" : "home",
        }),
      patchSettings: (p) =>
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...get().settings,
            ...p,
            permission: p.permission ?? get().settings.permission ?? "default",
          },
        }),
      setKey: (providerId, key) =>
        set({
          settings: {
            ...DEFAULT_SETTINGS,
            ...get().settings,
            keys: { ...get().settings.keys, [providerId]: key },
          },
        }),
      current: () => {
        const { sessions, currentId } = get();
        const raw = sessions.find((s) => s.id === currentId) ?? sessions[0]!;
        return migrateSession(raw);
      },
      newSession: (title) => {
        const s = createSession(title ?? "Untitled work");
        set({
          sessions: [s, ...get().sessions].slice(0, 24),
          currentId: s.id,
          activity: "home",
          mobileTab: "home",
          appMode: "work",
        });
        return s.id;
      },
      switchSession: (id) => {
        if (get().sessions.some((s) => s.id === id)) {
          const s = get().sessions.find((x) => x.id === id)!;
          set({
            currentId: id,
            activity: s.messages.length === 0 ? "home" : "files",
            mobileTab: s.messages.length === 0 ? "home" : "task",
          });
        }
      },
      renameSession: (id, title) =>
        set({
          sessions: get().sessions.map((s) =>
            s.id === id ? { ...s, title: title.trim() || s.title, updatedAt: Date.now() } : s,
          ),
        }),
      deleteSession: (id) => {
        const rest = get().sessions.filter((s) => s.id !== id);
        const next = rest.length ? rest : [createSession()];
        set({ sessions: next, currentId: next[0]!.id, activity: "home" });
      },
      patchCurrent: (fn) => {
        const id = get().currentId;
        set({
          sessions: get().sessions.map((s) => (s.id === id ? clampSession(fn(migrateSession(s))) : s)),
        });
      },
      upsertFile: (path, content) => {
        const p = safePath(path);
        if (!p) return;
        get().patchCurrent((s) => ({
          ...s,
          files: { ...s.files, [p]: { path: p, content, updatedAt: Date.now() } },
          openTabs: s.openTabs.includes(p) ? s.openTabs : [...s.openTabs, p],
          activeTab: p,
        }));
      },
      deleteFile: (path) => {
        get().patchCurrent((s) => {
          const files = { ...s.files };
          delete files[path];
          const openTabs = s.openTabs.filter((t) => t !== path);
          const activeTab =
            s.activeTab === path ? (openTabs[openTabs.length - 1] ?? null) : s.activeTab;
          return { ...s, files, openTabs, activeTab };
        });
      },
      openTab: (path) =>
        get().patchCurrent((s) => ({
          ...s,
          openTabs: s.openTabs.includes(path) ? s.openTabs : [...s.openTabs, path],
          activeTab: path,
        })),
      closeTab: (path) =>
        get().patchCurrent((s) => {
          const openTabs = s.openTabs.filter((t) => t !== path);
          const activeTab =
            s.activeTab === path ? (openTabs[openTabs.length - 1] ?? null) : s.activeTab;
          return { ...s, openTabs, activeTab };
        }),
      setActiveTab: (path) => get().patchCurrent((s) => ({ ...s, activeTab: path })),
      addMemory: (entry) =>
        get().patchCurrent((s) => ({
          ...s,
          memories: [
            ...s.memories,
            {
              id: uid(),
              createdAt: Date.now(),
              strength: entry.strength ?? 0.7,
              kind: entry.kind,
              content: entry.content,
              tags: entry.tags,
            },
          ],
        })),
      deleteMemory: (id) =>
        get().patchCurrent((s) => ({
          ...s,
          memories: s.memories.filter((m) => m.id !== id),
        })),
      setSwarm: (swarm) => get().patchCurrent((s) => ({ ...s, swarm })),
      snapshotFiles: () =>
        get().patchCurrent((s) => ({
          ...s,
          snapshots: [...s.snapshots, { at: Date.now(), files: structuredClone(s.files) }],
        })),
      undoFiles: () =>
        get().patchCurrent((s) => {
          const snap = s.snapshots[s.snapshots.length - 1];
          if (!snap) return s;
          return {
            ...s,
            files: snap.files,
            snapshots: s.snapshots.slice(0, -1),
            swarm: s.swarm.running ? s.swarm : idleSwarm(),
          };
        }),
      applyPending: () => {
        const pending = get().current().pending ?? [];
        if (!pending.length) return;
        get().snapshotFiles();
        for (const change of pending) {
          const path = safePath(change.path);
          if (!path) continue;
          if (change.action === "delete") get().deleteFile(path);
          else if (typeof change.content === "string") get().upsertFile(path, change.content);
        }
        get().patchCurrent((s) => ({ ...s, pending: [] }));
      },
      rejectPending: () => get().patchCurrent((s) => ({ ...s, pending: [] })),
      addCron: (job) =>
        set({
          cronJobs: [{ ...job, id: uid() }, ...get().cronJobs].slice(0, 20),
        }),
      patchCron: (id, p) =>
        set({
          cronJobs: get().cronJobs.map((j) => (j.id === id ? { ...j, ...p } : j)),
        }),
      deleteCron: (id) => set({ cronJobs: get().cronJobs.filter((j) => j.id !== id) }),
    }),
    {
      name: "codingagent.work.v2",
      partialize: (s) => ({
        sessions: s.sessions,
        currentId: s.currentId,
        settings: s.settings,
        cronJobs: s.cronJobs,
        appMode: s.appMode,
      }),
      skipHydration: true,
    },
  ),
);

export function useSession() {
  return useWork((s) => s.sessions.find((x) => x.id === s.currentId) ?? s.sessions[0]!);
}
