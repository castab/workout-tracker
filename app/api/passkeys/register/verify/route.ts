import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { verifyRegistrationResponse } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/app/demo-mode";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  deviceTypeFromLibrary,
  getExpectedOrigin,
  getRelyingPartyId,
  readAndClearRegistrationChallenge,
} from "@/lib/webauthn";

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

const maxNicknameLength = 60;

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Passkeys are disabled in demo mode." }, { status: 404 });
  }

  const user = await requireUser();
  const body = (await request.json()) as {
    response?: RegistrationResponseJSON;
    nickname?: string;
  };

  if (!body.response) {
    return NextResponse.json({ error: "missing_response" }, { status: 400 });
  }

  const expectedChallenge = await readAndClearRegistrationChallenge();

  if (!expectedChallenge) {
    return NextResponse.json({ error: "challenge_expired" }, { status: 400 });
  }

  const verification = await verifyRegistrationResponse({
    response: body.response,
    expectedChallenge,
    expectedOrigin: getExpectedOrigin(request),
    expectedRPID: getRelyingPartyId(request),
  });

  if (!verification.verified || !verification.registrationInfo) {
    return NextResponse.json({ error: "verification_failed" }, { status: 400 });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  const nickname = (body.nickname ?? "").trim().slice(0, maxNicknameLength);

  try {
    await prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        deviceType: deviceTypeFromLibrary(credentialDeviceType),
        backedUp: credentialBackedUp,
        nickname,
      },
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "already_registered" }, { status: 409 });
    }

    throw error;
  }

  return NextResponse.json({ ok: true }, { headers: noStoreHeaders });
}
