"use client";

import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useState } from "react";

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

function MetricFields({ reps, weight, time, distance, laps, isSaving }: {
  reps?: EditableMetric;
  weight?: EditableMetric;
  time?: EditableMetric;
  distance?: EditableMetric;
  laps?: EditableMetric;
  isSaving: boolean;
}) {
  return (
    <Grid container spacing={1}>
      <Grid size={6}>
        <TextField name="reps" label="Reps" defaultValue={reps?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="weight" label="Weight" defaultValue={weight?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="weightUnit" defaultValue={weight?.unit ?? "LB"} select size="small" sx={{ width: 86 }}>
            <MenuItem value="LB">lb</MenuItem>
            <MenuItem value="KG">kg</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="time" label="Time" defaultValue={time?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="timeUnit" defaultValue={time?.unit ?? "MINUTES"} select size="small" sx={{ width: 92 }}>
            <MenuItem value="SECONDS">sec</MenuItem>
            <MenuItem value="MINUTES">min</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <Stack direction="row" spacing={1}>
          <TextField name="distance" label="Distance" defaultValue={distance?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
          <TextField name="distanceUnit" defaultValue={distance?.unit ?? "MILES"} select size="small" sx={{ width: 88 }}>
            <MenuItem value="MILES">mi</MenuItem>
            <MenuItem value="KM">km</MenuItem>
            <MenuItem value="METERS">m</MenuItem>
          </TextField>
        </Stack>
      </Grid>
      <Grid size={6}>
        <TextField name="laps" label="Laps" defaultValue={laps?.value ?? ""} fullWidth size="small" slotProps={{ htmlInput: { inputMode: "decimal" } }} />
      </Grid>
      <Grid size={6}>
        <Button type="submit" variant="contained" fullWidth startIcon={<SaveIcon />} disabled={isSaving} sx={{ minHeight: 40 }}>
          Save
        </Button>
      </Grid>
    </Grid>
  );
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
      <Box
        component="form"
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
        sx={{ border: 1, borderColor: "primary.main", bgcolor: "background.default", borderRadius: 3, p: 1.5 }}
      >
        <Stack direction="row" spacing={1.5} sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.2em" }}>Edit {label}</Typography>
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={() => {
              setError("");
              setIsEditing(false);
            }}
          >
            Cancel
          </Button>
        </Stack>

        <MetricFields reps={reps} weight={weight} time={time} distance={distance} laps={laps} isSaving={isSaving} />

        {error ? <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert> : null}
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: "background.default", borderRadius: 3, p: 1.5 }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: "0.2em" }}>{label}</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>{summary}</Typography>
        </Box>

        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button
          type="button"
          variant="outlined"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setIsEditing(true)}
        >
          Edit
        </Button>
        <Box component="form" action={deleteAction}>
          <Button type="submit" variant="outlined" color="error" size="small" startIcon={<DeleteIcon />}>
            Remove
          </Button>
        </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
