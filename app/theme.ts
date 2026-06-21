"use client";

import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  cssVariables: true,
  palette: {
    mode: "dark",
    background: {
      default: "#09090b",
      paper: "#18181b",
    },
    primary: {
      main: "#bef264",
      light: "#d9f99d",
      dark: "#84cc16",
      contrastText: "#09090b",
    },
    secondary: {
      main: "#f4f4f5",
      contrastText: "#09090b",
    },
    warning: {
      main: "#fbbf24",
      contrastText: "#09090b",
    },
    error: {
      main: "#f87171",
    },
    text: {
      primary: "#fafafa",
      secondary: "#a1a1aa",
    },
    divider: "#27272a",
  },
  shape: {
    borderRadius: 18,
  },
  typography: {
    fontFamily: "var(--font-geist-sans), Arial, Helvetica, sans-serif",
    h1: { fontWeight: 900, letterSpacing: "-0.04em" },
    h2: { fontWeight: 900, letterSpacing: "-0.035em" },
    h3: { fontWeight: 900, letterSpacing: "-0.03em" },
    h4: { fontWeight: 900, letterSpacing: "-0.03em" },
    h5: { fontWeight: 900 },
    h6: { fontWeight: 900 },
    button: { fontWeight: 900, textTransform: "none" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          minHeight: "100%",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 16,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          border: "1px solid #27272a",
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.24)",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: "#09090b",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 800,
        },
      },
    },
  },
});
