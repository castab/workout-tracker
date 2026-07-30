"use client";

import { Icon } from "@/app/material-icon";

type MetricTileProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Amount one tap of −/+ moves the value. */
  step: number;
  unit?: string;
  onCycleUnit?: () => void;
};

/**
 * One metric as a number pad: big mono readout, an optional unit chip, and 44px
 * −/+ buttons. Typing is still possible, but the steppers are the point — they
 * work with a thumb, mid-set, without looking.
 */
export function MetricTile({ label, value, onChange, step, unit, onCycleUnit }: MetricTileProps) {
  function bump(direction: 1 | -1) {
    const current = value === "" ? 0 : Number(value);
    const base = Number.isFinite(current) ? current : 0;
    // From empty, "+" should land on one step rather than doubling to two.
    const start = value === "" && direction > 0 ? 0 : base;
    const next = Math.max(0, Math.round((start + direction * step) * 100) / 100);

    onChange(String(next));
  }

  const stepperStyle = {
    flex: 1,
    minWidth: 0,
    height: 44,
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--border-default)",
    background: "var(--surface-chip)",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "var(--transition-default)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-default)",
        background: "var(--surface-sunken)",
        padding: "var(--space-3)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--space-2)",
          minHeight: 20,
        }}
      >
        <span
          style={{
            font: "var(--type-eyebrow)",
            textTransform: "uppercase",
            letterSpacing: "var(--tracking-eyebrow-sm)",
            color: "var(--text-faint)",
          }}
        >
          {label}
        </span>
        {unit && onCycleUnit ? (
          <button
            type="button"
            onClick={onCycleUnit}
            aria-label={`Change ${label} unit, currently ${unit}`}
            style={{
              border: "1px solid var(--border-strong)",
              background: "transparent",
              color: "var(--text-muted)",
              cursor: "pointer",
              borderRadius: "var(--radius-pill)",
              padding: "2px 8px",
              minHeight: 28,
              font: "var(--weight-bold) var(--text-xs)/1 var(--font-mono)",
              transition: "var(--transition-default)",
            }}
          >
            {unit}
          </button>
        ) : null}
      </div>

      <input
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ""))}
        inputMode="decimal"
        placeholder="—"
        aria-label={label}
        style={{
          display: "block",
          width: "100%",
          minWidth: 0,
          margin: "var(--space-2) 0",
          border: "none",
          background: "transparent",
          outline: "none",
          textAlign: "center",
          color: value === "" ? "var(--text-faint)" : "var(--text-primary)",
          font: "var(--weight-black) var(--text-3xl)/1.1 var(--font-mono)",
          letterSpacing: "var(--tracking-tight)",
          padding: 0,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <button type="button" style={stepperStyle} onClick={() => bump(-1)} aria-label={`Decrease ${label} by ${step}`}>
          <Icon name="remove" size={22} />
        </button>
        <button type="button" style={stepperStyle} onClick={() => bump(1)} aria-label={`Increase ${label} by ${step}`}>
          <Icon name="add" size={22} />
        </button>
      </div>
    </div>
  );
}
