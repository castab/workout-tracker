import { generateRegistrationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/app/demo-mode";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getRelyingPartyId, rpName, setRegistrationChallenge } from "@/lib/webauthn";

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Passkeys are disabled in demo mode." }, { status: 404 });
  }

  const user = await requireUser();

  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID: getRelyingPartyId(request),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: "none",
    excludeCredentials: existingPasskeys.map((passkey) => ({
      id: passkey.credentialId,
      transports: passkey.transports as (
        | "ble"
        | "hybrid"
        | "internal"
        | "nfc"
        | "smart-card"
        | "usb"
      )[],
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "preferred",
    },
  });

  await setRegistrationChallenge(options.challenge);

  return NextResponse.json({ options }, { headers: noStoreHeaders });
}
