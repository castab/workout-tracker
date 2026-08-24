import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/app/demo-mode";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getExpectedOrigin,
  getRelyingPartyId,
  passkeyToWebAuthnCredential,
  readAndClearAuthenticationChallenge,
} from "@/lib/webauthn";

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Passkeys are disabled in demo mode." }, { status: 404 });
  }

  const body = (await request.json()) as { response?: AuthenticationResponseJSON };

  if (!body.response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  const expectedChallenge = await readAndClearAuthenticationChallenge();

  if (!expectedChallenge) {
    return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
  }

  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: body.response.id },
  });

  if (!passkey) {
    return NextResponse.json({ error: "unknown_credential" }, { status: 400 });
  }

  const verification = await verifyAuthenticationResponse({
    response: body.response,
    expectedChallenge,
    expectedOrigin: getExpectedOrigin(request),
    expectedRPID: getRelyingPartyId(request),
    credential: passkeyToWebAuthnCredential(passkey),
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: verification.authenticationInfo.newCounter,
      lastUsedAt: new Date(),
    },
  });

  await createSession(passkey.userId);

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
