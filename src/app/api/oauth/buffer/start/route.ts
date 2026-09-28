import { NextRequest, NextResponse } from "next/server";
import {
  bufferOAuthConfigured,
  generatePkcePair,
  signBufferOAuthState,
} from "@/lib/connectors/bufferAuth";

function appOrigin(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, "")}`;
  }
  return "http://localhost:3000";
}

export async function GET(req: NextRequest) {
  if (!bufferOAuthConfigured()) {
    return NextResponse.json(
      { error: "Buffer is not set up on this site yet." },
      { status: 503 }
    );
  }

  const userId = req.nextUrl.searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json(
      { error: "Please sign in and try Connect again." },
      { status: 400 }
    );
  }

  const clientId = process.env.BUFFER_CLIENT_ID!;
  const redirect = `${appOrigin()}/api/oauth/buffer/callback`;
  const { verifier, challenge } = generatePkcePair();
  const state = signBufferOAuthState(userId, verifier);
  const scopes = [
    "posts:read",
    "posts:write",
    "account:read",
    "offline_access",
  ].join(" ");

  const url = new URL("https://auth.buffer.com/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirect);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");

  return NextResponse.redirect(url.toString());
}
