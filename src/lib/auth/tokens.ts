import "server-only";
import crypto from "node:crypto";

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Tokens are stored hashed (peppered with SESSION_SECRET) so a DB leak doesn't leak live sessions. */
export function hashToken(token: string) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ characters)");
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}
