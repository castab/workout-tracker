import "server-only";

import { cookies } from "next/headers";
import type { CredentialDeviceType as LibraryCredentialDeviceType } from "@simplewebauthn/server";
import type { Passkey } from "@/lib/generated/prisma/client";
import { CredentialDeviceType } from "@/lib/generated/prisma/client";

export const rpName = "Workout Tracker";

const registrationChallengeCookieName = "webauthn_reg_challenge";
const authenticationChallengeCookieName = "webauthn_auth_challenge";
const challengeCookieMaxAgeSeconds = 5 * 60;

export function getRelyingPartyId(request: Request) {
  return new URL(request.url).hostname;
}

export function getExpectedOrigin(request: Request) {
  const origin = request.headers.get("origin");

  if (origin) {
    return origin;
  }

  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
}

async function setChallengeCookie(name: string, challenge: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, challenge, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/passkeys",
    maxAge: challengeCookieMaxAgeSeconds,
  });
}

async function readAndClearChallengeCookie(name: string) {
  const cookieStore = await cookies();
  const challenge = cookieStore.get(name)?.value ?? null;
  cookieStore.delete(name);
  return challenge;
}

export function setRegistrationChallenge(challenge: string) {
  return setChallengeCookie(registrationChallengeCookieName, challenge);
}

export function readAndClearRegistrationChallenge() {
  return readAndClearChallengeCookie(registrationChallengeCookieName);
}

export function setAuthenticationChallenge(challenge: string) {
  return setChallengeCookie(authenticationChallengeCookieName, challenge);
}

export function readAndClearAuthenticationChallenge() {
  return readAndClearChallengeCookie(authenticationChallengeCookieName);
}

export function passkeyToWebAuthnCredential(passkey: Passkey) {
  return {
    id: passkey.credentialId,
    publicKey: new Uint8Array(passkey.publicKey),
    counter: passkey.counter,
    transports: passkey.transports as (
      | "ble"
      | "hybrid"
      | "internal"
      | "nfc"
      | "smart-card"
      | "usb"
    )[],
  };
}

export function deviceTypeFromLibrary(deviceType: LibraryCredentialDeviceType) {
  return deviceType === "multiDevice"
    ? CredentialDeviceType.MULTI_DEVICE
    : CredentialDeviceType.SINGLE_DEVICE;
}
