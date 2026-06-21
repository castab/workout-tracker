"use client";

import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";

type ExerciseNameEditorProps = {
  name: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function ExerciseNameEditor({ name, action }: ExerciseNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box sx={{ mt: 1 }}>
      {isEditing ? (
        <Stack
          component="form"
          action={async (formData) => {
            setIsSaving(true);
            await action(formData);
            setIsSaving(false);
            setIsEditing(false);
          }}
          direction="row"
          spacing={1}
        >
          <TextField
            inputRef={inputRef}
            name="name"
            defaultValue={name}
            autoComplete="off"
            required
            fullWidth
            size="small"
          />
          <Button
            type="submit"
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={isSaving}
          >
            Save
          </Button>
        </Stack>
      ) : (
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h5" component="h2">{name}</Typography>
          <IconButton
            type="button"
            aria-label={`Edit ${name} name`}
            size="small"
            sx={{ border: 1, borderColor: "divider" }}
            onClick={() => {
              setIsEditing(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}
