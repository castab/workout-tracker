import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { NextResponse } from "next/server";
import { isDemoMode } from "@/app/demo-mode";
import { getRelyingPartyId, setAuthenticationChallenge } from "@/lib/webauthn";

const noStoreHeaders = {
  "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
};

export async function POST(request: Request) {
  if (isDemoMode()) {
    return NextResponse.json({ error: "Passkeys are disabled in demo mode." }, { status: 404 });
  }

  const options = await generateAuthenticationOptions({
    rpID: getRelyingPartyId(request),
    userVerification: "preferred",
  });

  await setAuthenticationChallenge(options.challenge);

  return NextResponse.json({ options }, { headers: noStoreHeaders });
}
