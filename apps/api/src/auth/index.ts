import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express } from "express";
import { pool } from "../db";

export function setupAuth(app: Express): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("⚠️ GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing. Google Auth will fail.");
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: clientId || "MISSING_CLIENT_ID",
        clientSecret: clientSecret || "MISSING_CLIENT_SECRET",
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          "http://localhost:3001/api/auth/google/callback",
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value ?? "";
          const name = profile.displayName ?? null;
          const avatarUrl = profile.photos?.[0]?.value ?? null;

          const { rows } = await pool.query(
            `INSERT INTO users (google_id, email, name, avatar_url)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (google_id) DO UPDATE
               SET email = EXCLUDED.email,
                   name = EXCLUDED.name,
                   avatar_url = EXCLUDED.avatar_url,
                   updated_at = NOW()
             RETURNING *`,
            [googleId, email, name, avatarUrl]
          );
          return done(null, rows[0]);
        } catch (err: unknown) {
          return done(err as Error);
        }
      }
    )
  );

  passport.serializeUser((user: Express.User, done) => {
    done(null, (user as { id: string }).id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const { rows } = await pool.query(
        "SELECT * FROM users WHERE id = $1",
        [id]
      );
      done(null, rows[0] ?? null);
    } catch (err) {
      done(err, null);
    }
  });

  app.use(passport.initialize());
  app.use(passport.session());
}
