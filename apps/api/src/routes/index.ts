import { Router } from "express";
import passport from "passport";
import campaignsRouter from "./campaigns";
import emailsRouter from "./emails";

const router = Router();

// Health
router.get("/health", async (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Google OAuth
router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));

router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:3000"}/login?error=auth_failed` }),
  (_req, res) => { res.redirect(process.env.FRONTEND_URL || "http://localhost:3000"); }
);

router.get("/auth/me", (req, res) => {
  if (!req.isAuthenticated()) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { id, email, name, avatar_url, created_at } = req.user as Record<string, unknown>;
  res.json({ id, email, name, avatar_url, created_at });
});

router.post("/auth/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => res.json({ success: true }));
  });
});

router.use("/campaigns", campaignsRouter);
router.use("/emails", emailsRouter);

export default router;
