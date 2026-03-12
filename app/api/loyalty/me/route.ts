// app/api/loyalty/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import dbConnect from "@/lib/config/database";
import User from "@/models/User";
import Booking from "@/models/Booking";
import Review from "@/models/Review";
import LoyaltyScore from "@/models/LoyaltyScore";
import {
  calculateUserScore,
  calculateVendorScore,
  resolveUserLevel,
  resolveVendorLevel,
  getLevelProgress,
  getNextLevel,
  shouldDemote,
  getPreviousLevel,
} from "@/lib/utils/loyaltyCalculator";

// Cast lean() result to access typed fields from the User schema
interface LeanUser {
  _id: mongoose.Types.ObjectId;
  accountType?: "user" | "vendor" | "admin";
  [key: string]: unknown;
}

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

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

    const userId = decoded.id || decoded._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    const user = (await User.findById(userId).lean()) as LeanUser | null;
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found" }, { status: 404 });
    }

    const accountType: "user" | "vendor" = user.accountType === "vendor" ? "vendor" : "user";
    const now = new Date();

    // ─────────────────────────────────────────────────────────────────────────
    // VENDOR
    // ─────────────────────────────────────────────────────────────────────────
    if (accountType === "vendor") {
      const bookings = await Booking.find({ vendorId: userId }).lean();
      const completedBookings = bookings.filter((b) => b.status === "completed");
      const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

      const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
      const totalBookings = completedBookings.length;
      const cancellations = cancelledBookings.length;

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthlyCancel = cancelledBookings.filter(
        (b) => b.cancelledAt && new Date(b.cancelledAt as Date) >= monthStart
      ).length;
      const repeatCancellations = monthlyCancel >= 3 ? Math.floor(monthlyCancel / 3) : 0;

      const vendorServiceIds = completedBookings
        .map((b) => b.stayId || b.tourId || b.adventureId || b.vehicleRentalId)
        .filter(Boolean);

      let avgRating = 0;
      if (vendorServiceIds.length > 0) {
        const reviews = await Review.find({
          targetId: { $in: vendorServiceIds },
          status: "approved",
        }).lean();
        if (reviews.length > 0) {
          avgRating = reviews.reduce((sum, r) => sum + (r.rating as number), 0) / reviews.length;
        }
      }

      // const — existing doc is only read, never reassigned
      const existing = await LoyaltyScore.findOne({ userId });
      const policyViolations = existing?.metrics?.policyViolations ?? 0;
      const fakeReviewAttempts = existing?.metrics?.fakeReviewAttempts ?? 0;
      const noShows = existing?.metrics?.noShows ?? 0;

      const metrics = {
        totalBookings,
        totalRevenue,
        avgRating: parseFloat(avgRating.toFixed(2)),
        cancellations,
        policyViolations,
        noShows,
        repeatCancellations,
        fakeReviewAttempts,
        ratingsGiven: 0,
        promoActivity: 0,
      };

      const rawScore = calculateVendorScore({
        totalBookings,
        totalRevenue,
        avgRating,
        cancellations,
        policyViolations,
        noShows,
        repeatCancellations,
        fakeReviewAttempts,
      });

      const penaltyTotal = existing?.penaltyScoreTotal ?? 0;
      const compositeScore = Math.max(0, rawScore - penaltyTotal);

      const levelData = resolveVendorLevel(compositeScore);
      const nextLevel = getNextLevel(compositeScore, "vendor");
      const progress = getLevelProgress(compositeScore, "vendor");

      // These ARE mutated inside the demotion block → let
      let demotionCount = existing?.demotionCount ?? 0;
      let demotionHistory = [...(existing?.demotionHistory ?? [])];
      let scoreBelowThresholdSince: Date | undefined = existing?.scoreBelowThresholdSince ?? undefined;
      let levelFrozen = existing?.levelFrozen ?? false;
      // isSuspended is never mutated → const
      const isSuspended = existing?.isSuspended ?? false;

      const currentLevelName = existing?.level ?? "Seedling";

      if (shouldDemote(currentLevelName, compositeScore, "vendor")) {
        if (!scoreBelowThresholdSince) {
          scoreBelowThresholdSince = now;
        } else {
          const daysBelowThreshold =
            (now.getTime() - scoreBelowThresholdSince.getTime()) / (1000 * 60 * 60 * 24);
          if (daysBelowThreshold >= 60) {
            const prevLevel = getPreviousLevel(currentLevelName, "vendor");
            demotionCount += 1;
            demotionHistory = [
              ...demotionHistory,
              {
                fromLevel: currentLevelName,
                toLevel: prevLevel.name,
                at: now,
                reason: "Score below threshold for 60 days",
              },
            ];
            scoreBelowThresholdSince = undefined;
            if (demotionCount >= 3) {
              levelFrozen = true;
            }
          }
        }
      } else {
        scoreBelowThresholdSince = undefined;
      }

      const loyaltyDoc = await LoyaltyScore.findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            accountType: "vendor",
            level: levelData.name,
            compositeScore,
            metrics,
            demotionCount,
            demotionHistory,
            scoreBelowThresholdSince,
            levelFrozen,
            isSuspended,
            currentDiscount: 0,
            perks: levelData.perks,
            lastCalculated: now,
          },
        },
        { upsert: true, new: true }
      );

      return NextResponse.json({
        success: true,
        loyalty: {
          accountType: "vendor",
          level: levelData,
          compositeScore,
          nextLevel,
          progress,
          metrics,
          penaltyHistory: loyaltyDoc.penaltyHistory?.slice(-5) ?? [],
          isSuspended,
          levelFrozen,
          demotionCount,
          demotionHistory: loyaltyDoc.demotionHistory?.slice(-3) ?? [],
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // USER
    // ─────────────────────────────────────────────────────────────────────────
    const bookings = await Booking.find({ customerId: userId }).lean();
    const completedBookings = bookings.filter((b) => b.status === "completed");
    const cancelledBookings = bookings.filter((b) => b.status === "cancelled");

    const totalBookings = completedBookings.length;
    const cancellations = cancelledBookings.length;
    const ratingsGiven = await Review.countDocuments({ userId, status: "approved" });

    // const — existing doc is only read, never reassigned
    const existing = await LoyaltyScore.findOne({ userId });
    const policyViolations = existing?.metrics?.policyViolations ?? 0;
    const promoActivity = existing?.metrics?.promoActivity ?? 0;
    const noShows = existing?.metrics?.noShows ?? 0;
    const avgRating = existing?.metrics?.avgRating ?? 5;
    const ratingDroppedBelow3 = avgRating < 3;

    const metrics = {
      totalBookings,
      ratingsGiven,
      promoActivity,
      policyViolations,
      cancellations,
      noShows,
      avgRating,
      totalRevenue: 0,
      fakeReviewAttempts: 0,
      repeatCancellations: 0,
    };

    const rawScore = calculateUserScore({
      totalBookings,
      ratingsGiven,
      promoActivity,
      policyViolations,
      cancellations,
      noShows,
      ratingDroppedBelow3,
    });

    const penaltyTotal = existing?.penaltyScoreTotal ?? 0;
    const compositeScore = Math.max(0, rawScore - penaltyTotal);

    const levelData = resolveUserLevel(compositeScore);
    const nextLevel = getNextLevel(compositeScore, "user");
    const progress = getLevelProgress(compositeScore, "user");
    const invoiceThreshold = 4000;
    const currentDiscount = levelData.discount;

    // These ARE mutated inside the demotion block → let
    let demotionCount = existing?.demotionCount ?? 0;
    let demotionHistory = [...(existing?.demotionHistory ?? [])];
    let scoreBelowThresholdSince: Date | undefined = existing?.scoreBelowThresholdSince ?? undefined;
    let levelFrozen = existing?.levelFrozen ?? false;
    // isSuspended is never mutated → const
    const isSuspended = existing?.isSuspended ?? false;

    const currentLevelName = existing?.level ?? "Scout";

    if (shouldDemote(currentLevelName, compositeScore, "user")) {
      if (!scoreBelowThresholdSince) {
        scoreBelowThresholdSince = now;
      } else {
        const daysBelowThreshold =
          (now.getTime() - scoreBelowThresholdSince.getTime()) / (1000 * 60 * 60 * 24);
        if (daysBelowThreshold >= 60) {
          const prevLevel = getPreviousLevel(currentLevelName, "user");
          demotionCount += 1;
          demotionHistory = [
            ...demotionHistory,
            {
              fromLevel: currentLevelName,
              toLevel: prevLevel.name,
              at: now,
              reason: "Score below threshold for 60 days",
            },
          ];
          scoreBelowThresholdSince = undefined;
          if (demotionCount >= 3) {
            levelFrozen = true;
          }
        }
      }
    } else {
      scoreBelowThresholdSince = undefined;
    }

    const loyaltyDoc = await LoyaltyScore.findOneAndUpdate(
      { userId },
      {
        $set: {
          userId,
          accountType: "user",
          level: levelData.name,
          compositeScore,
          metrics,
          demotionCount,
          demotionHistory,
          scoreBelowThresholdSince,
          levelFrozen,
          isSuspended,
          currentDiscount,
          perks: levelData.perks,
          lastCalculated: now,
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({
      success: true,
      loyalty: {
        accountType: "user",
        level: levelData,
        compositeScore,
        nextLevel,
        progress,
        metrics,
        penaltyHistory: loyaltyDoc.penaltyHistory?.slice(-5) ?? [],
        currentDiscount,
        invoiceThreshold,
        isSuspended,
        levelFrozen,
        demotionCount,
        demotionHistory: loyaltyDoc.demotionHistory?.slice(-3) ?? [],
      },
    });
  } catch (err) {
    console.error("Loyalty/me error:", err);
    return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
  }
}