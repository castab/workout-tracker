import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import { ensureInitialAdminUser, getCurrentUser } from "@/lib/auth";
import { loginAction } from "./actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  invalid: "Username or password is incorrect.",
  missing: "Username and password are required.",
};

const statusMessages: Record<string, string> = {
  "password-updated": "Password updated. Sign in with the new password.",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/");
  }

  await ensureInitialAdminUser();

  const { error, message: status } = await searchParams;
  const message = error ? errorMessages[error] : null;
  const statusMessage = status ? statusMessages[status] : null;

  return (
    <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", bgcolor: "background.default", px: 2, py: 3 }}>
      <Card component="section" sx={{ width: "100%", maxWidth: 400 }}>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.3em" }}>
              Workout Tracker
            </Typography>
            <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
              Private access for your gym notebook replacement.
            </Typography>
          </Box>

          <Stack spacing={2}>
            {statusMessage ? <Alert severity="success">{statusMessage}</Alert> : null}
            {message ? <Alert severity="error">{message}</Alert> : null}

            <Stack component="form" action={loginAction} spacing={2}>
              <TextField
                label="Username"
                name="username"
                type="text"
                autoCapitalize="none"
                autoComplete="username"
                defaultValue="admin"
                required
                fullWidth
              />
              <TextField
                label="Password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                fullWidth
              />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.7 }}>
                On first setup, sign in as admin. The initial password is printed once in the server logs.
              </Typography>
              <Button type="submit" variant="contained" size="large" fullWidth sx={{ minHeight: 56 }}>
                Sign in
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
