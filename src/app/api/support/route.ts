import { NextRequest, NextResponse } from "next/server";

const SUPPORT_TO = "nexa.com.intelligence@gmail.com";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const subject = String(body.subject || "").trim();
    const description = String(body.description || "").trim();
    const userEmail = String(body.userEmail || "").trim();
    const userName = String(body.userName || "").trim();
    const userId = String(body.userId || "").trim();

    if (!subject || subject.length < 3) {
      return NextResponse.json(
        { ok: false, message: "Please enter a short subject." },
        { status: 400 }
      );
    }
    if (!description || description.length < 10) {
      return NextResponse.json(
        { ok: false, message: "Please describe the issue in a bit more detail." },
        { status: 400 }
      );
    }
    if (subject.length > 200 || description.length > 8000) {
      return NextResponse.json(
        { ok: false, message: "That message is too long. Please shorten it." },
        { status: 400 }
      );
    }

    const mailSubject = `[Nexa Support] ${subject}`;
    const mailBody = [
      description,
      "",
      "---",
      `From: ${userName || "(not provided)"}`,
      `Email: ${userEmail || "(not provided)"}`,
      `User id: ${userId || "(not provided)"}`,
      `Sent: ${new Date().toISOString()}`,
    ].join("\n");

    const mailto = `mailto:${SUPPORT_TO}?subject=${encodeURIComponent(
      mailSubject
    )}&body=${encodeURIComponent(mailBody)}`;

    // Structured log for production support visibility (no secrets)
    console.info("[support]", {
      subject: subject.slice(0, 120),
      userId: userId || null,
      userEmail: userEmail || null,
      at: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: "Your support request is ready to send.",
      mailto,
      to: SUPPORT_TO,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "Could not prepare your request. Please try again." },
      { status: 500 }
    );
  }
}
