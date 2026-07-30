"use client";

import { useRef, useState } from "react";
import { PencilIcon } from "./workout-icons";

type ExerciseNameEditorProps = {
  name: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function ExerciseNameEditor({ name, action }: ExerciseNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-2">
      {isEditing ? (
        <form
          action={async (formData) => {
            setIsSaving(true);
            await action(formData);
            setIsSaving(false);
            setIsEditing(false);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-base font-black outline-none transition focus:border-lime-300 focus:ring-2 focus:ring-lime-300/20"
            name="name"
            defaultValue={name}
            autoComplete="off"
            required
          />
          <button
            className="h-12 rounded-2xl bg-lime-300 px-4 font-black text-zinc-950 transition hover:bg-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/30 disabled:opacity-60 disabled:hover:bg-lime-300"
            aria-label={`Save ${name} name`}
            disabled={isSaving}
          >
            Save
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-black">{name}</h2>
          <button
            type="button"
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-zinc-400 transition hover:border-lime-300 hover:text-lime-200 focus:outline-none focus:ring-2 focus:ring-lime-300/20"
            aria-label={`Edit ${name} name`}
            title={`Edit ${name} name`}
            onClick={() => {
              setIsEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <PencilIcon />
          </button>
        </div>
      )}
    </div>
  );
}
