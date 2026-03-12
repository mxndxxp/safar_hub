// app/api/admin/loyalty/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import dbConnect from "@/lib/config/database";
import LoyaltyScore from "@/models/LoyaltyScore";
import User from "@/models/User";

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    // Admin auth check
    const token = req.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    if (decoded.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("type"); // "user" | "vendor" | null (all)
    const page = parseInt(searchParams.get("page") ?? "1");
    const limit = parseInt(searchParams.get("limit") ?? "20");
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filterType === "user" || filterType === "vendor") {
      query.accountType = filterType;
    }

    const [loyaltyDocs, total] = await Promise.all([
      LoyaltyScore.find(query)
        .sort({ compositeScore: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "fullName email accountType avatar isVendorApproved")
        .lean(),
      LoyaltyScore.countDocuments(query),
    ]);

    // Also get users with no loyalty doc yet (score = 0 / Scout)
    const allUsers = await User.find({
      accountType: { $in: filterType ? [filterType] : ["user", "vendor"] },
    })
      .select("fullName email accountType avatar createdAt")
      .lean();

    const loyaltyUserIds = new Set(loyaltyDocs.map((d: any) => d.userId?._id?.toString()));

    const zeroScoreUsers = allUsers
      .filter((u: any) => !loyaltyUserIds.has(u._id.toString()))
      .map((u: any) => ({
        _id: null,
        userId: u,
        accountType: u.accountType,
        level: u.accountType === "vendor" ? "Seedling" : "Scout",
        compositeScore: 0,
        metrics: {
          totalBookings: 0,
          avgRating: 0,
          cancellations: 0,
          policyViolations: 0,
          totalRevenue: 0,
        },
        isSuspended: false,
        levelFrozen: false,
        demotionCount: 0,
        currentDiscount: 0,
        lastCalculated: null,
      }));

    const combined = [...loyaltyDocs, ...zeroScoreUsers];

    // Summary stats
    const suspendedCount = loyaltyDocs.filter((d: any) => d.isSuspended).length;
    const frozenCount = loyaltyDocs.filter((d: any) => d.levelFrozen).length;

    const levelDistribution = loyaltyDocs.reduce((acc: Record<string, number>, d: any) => {
      acc[d.level] = (acc[d.level] ?? 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: combined,
      pagination: {
        total: total + zeroScoreUsers.length,
        page,
        limit,
        pages: Math.ceil((total + zeroScoreUsers.length) / limit),
      },
      summary: {
        totalTracked: total,
        suspended: suspendedCount,
        frozen: frozenCount,
        levelDistribution,
      },
    });
  } catch (err) {
    console.error("Admin loyalty error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}

// ── PATCH: Apply penalty/suspension manually from admin panel ─────────────────
export async function PATCH(req: NextRequest) {
  try {
    await dbConnect();

    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ success: false }, { status: 401 });

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!);
    } catch {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    if (decoded.accountType !== "admin") {
      return NextResponse.json({ success: false, message: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { targetUserId, action, scoreDeduction, note } = body;

    // action: "penalty" | "suspend" | "unsuspend" | "freeze" | "unfreeze"
    const doc = await LoyaltyScore.findOne({ userId: targetUserId });
    if (!doc) {
      return NextResponse.json({ success: false, message: "No loyalty record found" }, { status: 404 });
    }

    if (action === "penalty") {
      doc.penaltyHistory.push({
        event: note ?? "Admin penalty",
        scoreDeduction: scoreDeduction ?? 0,
        appliedAt: new Date(),
        appliedBy: decoded.id,
        note,
      });
      doc.penaltyScoreTotal = (doc.penaltyScoreTotal ?? 0) + (scoreDeduction ?? 0);
      doc.compositeScore = Math.max(0, doc.compositeScore - (scoreDeduction ?? 0));
    } else if (action === "suspend") {
      doc.isSuspended = true;
      doc.suspendedAt = new Date();
      doc.suspensionReason = note ?? "Admin action";
    } else if (action === "unsuspend") {
      doc.isSuspended = false;
      doc.suspendedAt = undefined;
      doc.suspensionReason = undefined;
    } else if (action === "freeze") {
      doc.levelFrozen = true;
      doc.freezeReason = note ?? "Admin action";
    } else if (action === "unfreeze") {
      doc.levelFrozen = false;
      doc.freezeReason = undefined;
    }

    await doc.save();

    return NextResponse.json({ success: true, doc });
  } catch (err) {
    console.error("Admin loyalty PATCH error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}