import AddIcon from "@mui/icons-material/Add";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { logoutAction } from "@/app/login/actions";
import { LocalDateTime } from "@/app/local-date-time";
import { createWorkoutAction } from "@/app/workouts/actions";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function WorkoutDate({ date }: { date: Date }) {
  return <LocalDateTime isoString={date.toISOString()} fallback={formatDate(date)} />;
}

export default async function Home() {
  const user = await requireUser();
  const workouts = await prisma.workout.findMany({
    where: { userId: user.id },
    orderBy: { startedAt: "desc" },
    take: 8,
    include: {
      exercises: {
        include: { sets: true },
      },
    },
  });

  const activeWorkout = workouts.find((workout) => !workout.endedAt);

  return (
    <Box component="main" sx={{ minHeight: "100vh", bgcolor: "background.default", py: 2.5 }}>
      <Container maxWidth="sm" disableGutters sx={{ px: 2 }}>
        <Stack spacing={2.5}>
          <Card component="header">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="overline" color="primary" sx={{ fontWeight: 900, letterSpacing: "0.3em" }}>
                    Workout Tracker
                  </Typography>
                  <Typography variant="h4" component="h1" sx={{ mt: 1 }}>
                    Ready to train?
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Password-protected access.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>
                    Signed in as {user.username}
                  </Typography>
                </Box>

                <Stack direction="row" spacing={1}>
                  <IconButton href="/settings" aria-label="Settings" title="Settings" sx={{ border: 1, borderColor: "divider" }}>
                    <SettingsIcon />
                  </IconButton>
                  <Box component="form" action={logoutAction}>
                    <IconButton type="submit" aria-label="Logout" title="Logout" sx={{ border: 1, borderColor: "divider" }}>
                      <LogoutIcon />
                    </IconButton>
                  </Box>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {activeWorkout ? (
            <Card sx={{ bgcolor: "primary.main", color: "primary.contrastText", borderColor: "rgba(190, 242, 100, 0.4)" }}>
              <CardActionArea href={`/workouts/${activeWorkout.id}`}>
                <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: "0.2em" }}>
                    Active workout
                  </Typography>
                  <Typography variant="h5" component="p" sx={{ mt: 1 }}>
                    Continue workout
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 800 }}>
                    Started <WorkoutDate date={activeWorkout.startedAt} />
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          ) : (
            <Box component="form" action={createWorkoutAction}>
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ minHeight: 64, borderRadius: 3, fontSize: "1.125rem" }}>
                Start a new workout
              </Button>
            </Box>
          )}

          <Card component="section">
            <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
              <Stack direction="row" spacing={2} sx={{ mb: 2, alignItems: "flex-end", justifyContent: "space-between" }}>
                <Box>
                  <Typography variant="h6" component="h2">Recent workouts</Typography>
                  <Typography variant="body2" color="text.secondary">Your latest sessions and set counts.</Typography>
                </Box>

                {activeWorkout ? (
                  <Box component="form" action={createWorkoutAction}>
                    <Button type="submit" variant="contained" color="secondary" size="small" startIcon={<AddIcon />}>
                      New
                    </Button>
                  </Box>
                ) : null}
              </Stack>

              {workouts.length === 0 ? (
                <Box sx={{ border: 1, borderStyle: "dashed", borderColor: "divider", borderRadius: 3, p: 3, textAlign: "center" }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>No workouts yet.</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Start one when you get to the gym.</Typography>
                </Box>
              ) : (
                <Stack spacing={1.5}>
                  {workouts.map((workout) => {
                    const setCount = workout.exercises.reduce(
                      (count, exercise) => count + exercise.sets.length,
                      0,
                    );

                    return (
                      <Card key={workout.id} variant="outlined" sx={{ bgcolor: "background.default" }}>
                        <CardActionArea href={`/workouts/${workout.id}`}>
                          <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                            <Stack direction="row" spacing={2} sx={{ alignItems: "center", justifyContent: "space-between" }}>
                              <Box>
                                <Typography sx={{ fontWeight: 900 }}><WorkoutDate date={workout.startedAt} /></Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                                  {workout.exercises.length} exercises · {setCount} sets
                                </Typography>
                              </Box>
                              <Chip label={workout.endedAt ? "Done" : "Active"} color={workout.endedAt ? "default" : "primary"} size="small" />
                            </Stack>
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Stack>
      </Container>
    </Box>
  );
}
