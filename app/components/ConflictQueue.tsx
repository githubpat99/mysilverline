"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/db/schema";
import { getLocalUserId } from "@/lib/services/authService";
import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

type ConflictItem = {
  type: "profile" | "position" | "event";
  id: string;
  label: string;
  localUpdated: number;
  remoteUpdated: number | null;
};

export default function ConflictQueue({
  onResolved,
}: {
  onResolved?: () => void;
}) {
  const [items, setItems] = useState<ConflictItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const localUserId = getLocalUserId();
    const load = async () => {
      const [profileRec, positionRecs, eventRecs] = await Promise.all([
        db.profile.get(localUserId),
        db.positions.where("local_user_id").equals(localUserId).filter((r) => r.sync_status === "conflict").toArray(),
        db.events.where("local_user_id").equals(localUserId).filter((r) => r.sync_status === "conflict").toArray(),
      ]);

      const list: ConflictItem[] = [];
      if (profileRec?.sync_status === "conflict") {
        list.push({
          type: "profile",
          id: "profile",
          label: "Profil",
          localUpdated: profileRec.local_updated_at,
          remoteUpdated: profileRec.remote_updated_at,
        });
      }
      for (const p of positionRecs) {
        list.push({
          type: "position",
          id: p.instrument_id,
          label: p.data?.label ?? p.instrument_id,
          localUpdated: p.local_updated_at,
          remoteUpdated: p.remote_updated_at,
        });
      }
      for (const e of eventRecs) {
        list.push({
          type: "event",
          id: e.client_id,
          label: e.data?.title ?? e.client_id,
          localUpdated: e.local_updated_at,
          remoteUpdated: e.remote_updated_at,
        });
      }
      setItems(list);
      if (list.length > 0) setOpen(true);
    };
    void load();
  }, [onResolved]);

  async function resolveKeepLocal(item: ConflictItem) {
    const localUserId = getLocalUserId();
    if (item.type === "profile") {
      const rec = await db.profile.get(localUserId);
      if (rec) await db.profile.update(localUserId, { sync_status: "modified" });
    } else if (item.type === "position") {
      const recs = await db.positions
        .where("local_user_id")
        .equals(localUserId)
        .filter((r) => r.instrument_id === item.id)
        .toArray();
      for (const r of recs) {
        if (r.id != null) await db.positions.update(r.id, { sync_status: "modified" });
      }
    } else if (item.type === "event") {
      const recs = await db.events
        .where("local_user_id")
        .equals(localUserId)
        .filter((r) => r.client_id === item.id)
        .toArray();
      for (const r of recs) {
        if (r.id != null) await db.events.update(r.id, { sync_status: "modified" });
      }
    }
    setItems((prev) => prev.filter((i) => i.id !== item.id || i.type !== item.type));
    onResolved?.();
  }

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-700/60 bg-amber-950/20 p-3">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-2 text-sm font-medium text-amber-300">
          <AlertTriangle size={16} />
          {items.length} Konflikt{items.length !== 1 ? "e" : ""} – bitte auflösen
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="p-1 -m-1 text-slate-400 hover:text-slate-200"
          aria-label={open ? "Einklappen" : "Aufklappen"}
        >
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      {open && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <span className="text-slate-200">{item.label}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolveKeepLocal(item)}
                  className="rounded border border-slate-600 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
                >
                  Lokale Version behalten
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
