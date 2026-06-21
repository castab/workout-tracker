import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";

export default function OfflinePage() {
  return (
    <Box component="main" sx={{ minHeight: "100dvh", display: "grid", placeItems: "center", bgcolor: "background.default", px: 2, py: 3 }}>
      <Card component="section" sx={{ width: "100%", maxWidth: 400, textAlign: "center" }}>
        <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: "0.3em" }}>
            Workout Tracker
          </Typography>
          <Typography variant="h4" component="h1" sx={{ mt: 2 }}>
            You are offline
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, lineHeight: 1.7 }}>
            Reconnect to load workouts, sign in, or save changes. Offline workout entry is
            not enabled yet.
          </Typography>
          <Button href="/" variant="contained" sx={{ mt: 3, minHeight: 48 }}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}
