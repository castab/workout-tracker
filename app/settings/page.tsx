import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { minimumPasswordLength } from "@/lib/users";
import {
  changePasswordAction,
  createUserAction,
  transferAdminAction,
  updateOwnUsernameAction,
  updateUserUsernameAction,
} from "./actions";

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  searchParams: Promise<{ error?: string; message?: string }>;
};

const errorMessages: Record<string, string> = {
  admin: "Admin access is required.",
  current: "Current password is incorrect.",
  duplicate: "That username is already in use.",
  match: "New passwords do not match.",
  missing: "All password fields are required.",
  short: "New password must be at least 12 characters.",
  userMissing: "User could not be found.",
  username: "Username must be 3-32 characters using lowercase letters, numbers, underscores, or hyphens.",
  userPasswordMissing: "Initial password is required.",
  userPasswordShort: "Initial password must be at least 12 characters.",
};

const statusMessages: Record<string, string> = {
  "admin-transferred": "Admin role transferred.",
  "admin-unchanged": "That user is already the admin.",
  "user-created": "User created.",
  "username-updated": "Username updated.",
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const user = await requireUser();
  const users = user.role === "ADMIN"
    ? await prisma.user.findMany({ orderBy: [{ role: "desc" }, { username: "asc" }] })
    : [];

  const { error, message: status } = await searchParams;
  const message = error ? errorMessages[error] : null;
  const statusMessage = status ? statusMessages[status] : null;

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", py: 2.5 }}>
      <Container maxWidth="sm" disableGutters sx={{ px: 2 }}>
        <Stack spacing={2.5}>
          <Card component="header">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Button href="/" startIcon={<ArrowBackIcon />} sx={{ px: 0 }}>
                Back to workouts
              </Button>
              <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
                Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, lineHeight: 1.7 }}>
                Manage your account and password.
              </Typography>
            </CardContent>
          </Card>

          {statusMessage ? <Alert severity="success">{statusMessage}</Alert> : null}
          {message ? <Alert severity="error">{message}</Alert> : null}

          <Card component="section">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Typography variant="h6" component="h2">Account</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 700 }}>
                Signed in as {user.username}. Role: {user.role.toLowerCase()}.
              </Typography>
              <Stack component="form" action={updateOwnUsernameAction} spacing={2} sx={{ mt: 2.5 }}>
                <TextField name="username" label="Username" type="text" autoCapitalize="none" autoComplete="username" defaultValue={user.username} required fullWidth />
                <Button type="submit" variant="contained" color="secondary" size="large" fullWidth sx={{ minHeight: 56 }}>
                  Save username
                </Button>
              </Stack>
            </CardContent>
          </Card>

          <Card component="section">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Typography variant="h6" component="h2">Password</Typography>
              <Stack component="form" action={changePasswordAction} spacing={2} sx={{ mt: 2.5 }}>
                <TextField name="currentPassword" label="Current password" type="password" autoComplete="current-password" required fullWidth />
                <TextField name="newPassword" label="New password" type="password" autoComplete="new-password" required fullWidth slotProps={{ htmlInput: { minLength: minimumPasswordLength } }} />
                <TextField name="confirmPassword" label="Confirm new password" type="password" autoComplete="new-password" required fullWidth slotProps={{ htmlInput: { minLength: minimumPasswordLength } }} />
                <Button type="submit" variant="contained" size="large" fullWidth sx={{ minHeight: 56 }}>
                  Change password
                </Button>
              </Stack>
            </CardContent>
          </Card>

          {user.role === "ADMIN" ? (
            <Card component="section">
              <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                <Typography variant="h6" component="h2">Users</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontWeight: 700 }}>
                  Create users, rename accounts, and transfer the single admin role.
                </Typography>

                <Card variant="outlined" sx={{ mt: 2.5, bgcolor: "background.default" }}>
                  <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                    <Typography sx={{ fontWeight: 900, mb: 2 }}>Create user</Typography>
                    <Stack component="form" action={createUserAction} spacing={2}>
                      <TextField name="username" label="Username" type="text" autoCapitalize="none" autoComplete="off" required fullWidth />
                      <TextField name="password" label="Initial password" type="password" autoComplete="new-password" required fullWidth slotProps={{ htmlInput: { minLength: minimumPasswordLength } }} />
                      <Button type="submit" variant="contained" size="large" fullWidth sx={{ minHeight: 56 }}>
                        Create user
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Stack spacing={1.5} sx={{ mt: 2.5 }}>
                  {users.map((listedUser) => (
                    <Card key={listedUser.id} variant="outlined" sx={{ bgcolor: "background.default" }}>
                      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                        <Stack direction="row" spacing={2} sx={{ mb: 1.5, alignItems: "center", justifyContent: "space-between" }}>
                          <Box>
                            <Typography sx={{ fontWeight: 900 }}>{listedUser.username}</Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{listedUser.role.toLowerCase()}</Typography>
                          </Box>
                          {listedUser.role === "ADMIN" ? <Chip label="Admin" color="primary" size="small" /> : null}
                        </Stack>

                        <Stack component="form" action={updateUserUsernameAction.bind(null, listedUser.id)} direction="row" spacing={1}>
                          <TextField name="username" type="text" autoCapitalize="none" defaultValue={listedUser.username} required fullWidth size="small" />
                          <Button type="submit" variant="contained" color="secondary">Rename</Button>
                        </Stack>

                        {listedUser.role !== "ADMIN" ? (
                          <>
                            <Divider sx={{ my: 1.5 }} />
                            <Box component="form" action={transferAdminAction.bind(null, listedUser.id)}>
                              <Button type="submit" variant="outlined" color="warning" fullWidth>
                                Transfer admin to {listedUser.username}
                              </Button>
                            </Box>
                          </>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
