import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// In-memory OTP store (use Redis/DB in production)
// Key: "admin_otp", Value: { otp, expiresAt }
const otpStore = new Map<string, { otp: string; expiresAt: number }>();

const ADMIN_EMAIL = "Safarhub1@gmail.com";
const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: NextRequest) {
  try {
    // Verify admin session
    const cookie = req.headers.get("cookie") || "";
    const verifyRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/auth/verify`, {
      headers: { cookie },
    });
    if (!verifyRes.ok) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }
    const { user } = await verifyRes.json();
    if (!user || user.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    // Generate OTP
    const otp = generateOtp();
    otpStore.set("admin_otp", {
      otp,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    // Send email via Nodemailer
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.SMTP_EMAIL,       // your sending Gmail address
        pass: process.env.SMTP_PASSWORD,    // app password (not real password)
      },
    });

    await transporter.sendMail({
      from: `"SafarHub Admin" <${process.env.SMTP_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "SafarHub Admin — Password Change OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
          <h2 style="color: #1e293b; margin-bottom: 8px;">Password Change Request</h2>
          <p style="color: #64748b; font-size: 14px;">Use the OTP below to confirm your admin password change.</p>

          <div style="margin: 28px 0; text-align: center;">
            <span style="
              display: inline-block;
              font-size: 36px;
              font-weight: 700;
              letter-spacing: 10px;
              color: #4f46e5;
              background: #eef2ff;
              padding: 16px 28px;
              border-radius: 12px;
            ">${otp}</span>
          </div>

          <p style="color: #94a3b8; font-size: 13px; text-align: center;">
            This OTP expires in <strong>10 minutes</strong>.<br/>
            If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, message: "OTP sent to admin email." });
  } catch (err) {
    console.error("[send-otp] error:", err);
    return NextResponse.json(
      { success: false, message: "Failed to send OTP. Check server logs." },
      { status: 500 }
    );
  }
}

// Export otpStore so the change-password route can access it
export { otpStore };