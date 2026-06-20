export const minimumPasswordLength = 12;

const usernamePattern = /^[a-z0-9_-]+$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function isValidUsername(username: string) {
  return username.length >= 3 && username.length <= 32 && usernamePattern.test(username);
}
