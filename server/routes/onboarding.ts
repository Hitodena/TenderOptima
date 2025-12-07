import { Router, type Request } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { db } from "../db";
import { onboardingProgress } from "@shared/schema";
import { eq } from "drizzle-orm";

const router = Router();

const isOnboardingEnabled = () => {
  const flag = (process.env.ONBOARDING_ENABLED ?? "true").toLowerCase();
  return !(flag === "false" || flag === "0");
};

type AuthenticatedRequest = Request & {
  user?: { id?: number };
  session?: {
    passport?: { user?: number };
  };
};

const resolveUserId = (req: AuthenticatedRequest): number | null => {
  if (req.user?.id) {
    return req.user.id;
  }
  if (req.session?.passport?.user) {
    return Number(req.session.passport.user);
  }
  return null;
};

router.get("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = resolveUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  if (!isOnboardingEnabled()) {
    return res.json({ enabled: false, completed: [] });
  }

  try {
    const rows = await db
      .select({ pageKey: onboardingProgress.pageKey })
      .from(onboardingProgress)
      .where(eq(onboardingProgress.userId, userId));

    return res.json({
      enabled: true,
      completed: rows.map((row) => row.pageKey),
    });
  } catch (error) {
    console.error("[Onboarding] Failed to fetch progress:", error);
    return res.status(500).json({ error: "Failed to load onboarding state" });
  }
});

router.post("/", requireAuth, async (req: AuthenticatedRequest, res) => {
  const userId = resolveUserId(req);

  if (!userId) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const pageKey = typeof req.body?.pageKey === "string" ? req.body.pageKey.trim() : "";

  if (!pageKey) {
    return res.status(400).json({ error: "pageKey is required" });
  }

  if (!isOnboardingEnabled()) {
    return res.json({ enabled: false, completed: [] });
  }

  try {
    await db
      .insert(onboardingProgress)
      .values({
        userId,
        pageKey,
        completedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [onboardingProgress.userId, onboardingProgress.pageKey],
        set: {
          completedAt: new Date(),
        },
      });

    return res.json({ success: true, pageKey });
  } catch (error) {
    console.error("[Onboarding] Failed to save progress:", error);
    return res.status(500).json({ error: "Failed to save onboarding state" });
  }
});

export default router;

