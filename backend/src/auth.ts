import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

function deriveKey(password: string, salt: string, length: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, length, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const authSecret = process.env.AUTH_SECRET || "";

export type AppRole = "ADMIN" | "AGENT" | "VIEWER";
export interface SessionUser { id: string; name: string; email: string; role: AppRole; customerId?: string | null; }
export type AuthenticatedRequest = Request & { authUser?: SessionUser };

function requireSecret() {
  if (authSecret.length < 32) throw new Error("AUTH_SECRET must contain at least 32 characters. Add it to backend/.env.");
  return authSecret;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await deriveKey(password, salt, 64);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = await deriveKey(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createSessionToken(user: SessionUser): string {
  const secret = requireSecret();
  const payload = Buffer.from(JSON.stringify({ ...user, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

function readSessionToken(token: string): SessionUser | null {
  try {
    const secret = requireSecret();
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;
    const expected = createHmac("sha256", secret).update(payload).digest();
    const actual = Buffer.from(signature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionUser & { exp?: number };
    if (!decoded.id || !decoded.email || !decoded.name || !["ADMIN", "AGENT", "VIEWER"].includes(decoded.role) || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return { id: decoded.id, name: decoded.name, email: decoded.email, role: decoded.role, customerId: decoded.customerId ?? null };
  } catch { return null; }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const user = token ? readSessionToken(token) : null;
  if (!user) return res.status(401).json({ error: "Authentication required. Please sign in again." });
  (req as AuthenticatedRequest).authUser = user;
  return next();
}

export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).authUser;
    if (!user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "You do not have permission to perform this action" });
    return next();
  };
}

export function sessionUser(req: Request): SessionUser {
  const user = (req as AuthenticatedRequest).authUser;
  if (!user) throw new Error("Authenticated user is missing");
  return user;
}
