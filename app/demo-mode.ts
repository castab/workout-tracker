export function isDemoMode() {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.APP_MODE === "demo";
}
