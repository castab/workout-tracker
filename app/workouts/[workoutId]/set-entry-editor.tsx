"use client";

import { useState } from "react";
import { PencilIcon, TrashIcon } from "./workout-icons";

type EditableMetric = {
  type: string;
  value: string;
  unit: string;
};

type SetEntryEditorProps = {
  label: string;
  summary: string;
  metrics: EditableMetric[];
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
};

function metric(metrics: EditableMetric[], type: string) {
  return metrics.find((item) => item.type === type);
}

function hasAtLeastOneMetric(formData: FormData) {
  return ["reps", "weight", "time", "distance", "laps"].some((name) => String(formData.get(name) ?? "").trim() !== "");
}

export function SetEntryEditor({ label, summary, metrics, updateAction, deleteAction }: SetEntryEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const reps = metric(metrics, "REPS");
  const weight = metric(metrics, "WEIGHT");
  const time = metric(metrics, "TIME");
  const distance = metric(metrics, "DISTANCE");
  const laps = metric(metrics, "LAPS");

  if (isEditing) {
    return (
      <form
        action={async (formData) => {
          if (!hasAtLeastOneMetric(formData)) {
            setError("Keep at least one entry value.");
            return;
          }

          setError("");
          setIsSaving(true);
          await updateAction(formData);
          setIsSaving(false);
          setIsEditing(false);
        }}
        className="rounded-2xl border border-lime-300/30 bg-zinc-950 p-3"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-200">Edit {label}</p>
          <button
            type="button"
            className="rounded-full border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300"
            onClick={() => {
              setError("");
              setIsEditing(false);
            }}
          >
            Cancel
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <input className="metric-input" name="reps" inputMode="decimal" placeholder="Reps" defaultValue={reps?.value ?? ""} />
          <div className="flex gap-1">
            <input className="metric-input" name="weight" inputMode="decimal" placeholder="Weight" defaultValue={weight?.value ?? ""} />
            <select className="metric-select" name="weightUnit" defaultValue={weight?.unit ?? "LB"}>
              <option value="LB">lb</option>
              <option value="KG">kg</option>
            </select>
          </div>
          <div className="flex gap-1">
            <input className="metric-input" name="time" inputMode="decimal" placeholder="Time" defaultValue={time?.value ?? ""} />
            <select className="metric-select" name="timeUnit" defaultValue={time?.unit ?? "MINUTES"}>
              <option value="SECONDS">sec</option>
              <option value="MINUTES">min</option>
            </select>
          </div>
          <div className="flex gap-1">
            <input className="metric-input" name="distance" inputMode="decimal" placeholder="Distance" defaultValue={distance?.value ?? ""} />
            <select className="metric-select" name="distanceUnit" defaultValue={distance?.unit ?? "MILES"}>
              <option value="MILES">mi</option>
              <option value="KM">km</option>
              <option value="METERS">m</option>
            </select>
          </div>
          <input className="metric-input" name="laps" inputMode="decimal" placeholder="Laps" defaultValue={laps?.value ?? ""} />
          <button className="h-12 rounded-xl bg-lime-300 px-4 font-black text-zinc-950 disabled:opacity-60" disabled={isSaving}>
            Save
          </button>
        </div>

        {error ? <p className="mt-2 text-sm font-semibold text-red-200">{error}</p> : null}
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-zinc-200">{summary}</p>
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700"
          aria-label={`Edit ${label}`}
          title={`Edit ${label}`}
          onClick={() => setIsEditing(true)}
        >
          <PencilIcon />
        </button>
        <form action={deleteAction}>
          <button
            className="inline-flex size-9 items-center justify-center rounded-full bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700"
            aria-label={`Remove ${label}`}
            title={`Remove ${label}`}
          >
            <TrashIcon />
          </button>
        </form>
      </div>
    </div>
  );
}
