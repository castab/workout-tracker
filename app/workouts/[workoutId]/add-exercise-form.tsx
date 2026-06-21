"use client";

import AddIcon from "@mui/icons-material/Add";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRef, useState } from "react";

export type ExerciseSuggestion = {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string;
};

type AddExerciseFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  suggestions: ExerciseSuggestion[];
};

function formatLastUsed(lastUsedAt: string) {
  const daysAgo = Math.floor((Date.now() - new Date(lastUsedAt).getTime()) / 86_400_000);

  if (daysAgo <= 0) return "today";
  if (daysAgo === 1) return "yesterday";
  if (daysAgo < 14) return `${daysAgo}d ago`;
  if (daysAgo < 60) return `${Math.floor(daysAgo / 7)}w ago`;

  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(lastUsedAt));
}

export function AddExerciseForm({ action, suggestions }: AddExerciseFormProps) {
  const [name, setName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const query = name.trim().toLowerCase();
  const matches = query.length >= 3
    ? suggestions
        .filter((suggestion) => {
          const suggestionName = suggestion.name.toLowerCase();

          return suggestionName.includes(query) && suggestionName !== query;
        })
        .sort((a, b) => {
          const aStartsWith = a.name.toLowerCase().startsWith(query);
          const bStartsWith = b.name.toLowerCase().startsWith(query);

          if (aStartsWith !== bStartsWith) return aStartsWith ? -1 : 1;

          return suggestions.indexOf(a) - suggestions.indexOf(b);
        })
        .slice(0, 5)
    : [];

  return (
    <Stack ref={formRef} component="form" action={action} spacing={1.5} sx={{ mt: 2 }}>
      <Stack direction="row" spacing={1}>
        <TextField
          inputRef={inputRef}
          name="name"
          placeholder="Bench Press"
          autoComplete="off"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          fullWidth
        />
        <Button type="submit" variant="contained" startIcon={<AddIcon />}>
          Add
        </Button>
      </Stack>

      {matches.length > 0 ? (
        <Card variant="outlined" sx={{ bgcolor: "background.default" }}>
          <CardContent sx={{ p: 1, "&:last-child": { pb: 1 } }}>
            <Typography variant="overline" color="text.secondary" sx={{ px: 1, pb: 1, display: "block", fontWeight: 800, letterSpacing: "0.2em" }}>
              Suggestions
            </Typography>
            <Stack spacing={0.5}>
            {matches.map((suggestion) => (
              <Button
                key={suggestion.id}
                type="button"
                color="inherit"
                sx={{ minHeight: 56, justifyContent: "space-between", px: 1.5, textAlign: "left" }}
                onClick={() => {
                  setName(suggestion.name);

                  if (inputRef.current) {
                    inputRef.current.value = suggestion.name;
                  }

                  formRef.current?.requestSubmit();
                }}
              >
                <Typography component="span" sx={{ fontWeight: 800 }}>{suggestion.name}</Typography>
                <Typography component="span" variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontWeight: 700 }}>
                  Used {suggestion.usageCount}x - {formatLastUsed(suggestion.lastUsedAt)}
                </Typography>
              </Button>
            ))}
            </Stack>
          </CardContent>
        </Card>
      ) : null}
    </Stack>
  );
}
