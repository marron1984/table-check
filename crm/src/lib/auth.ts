import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const SECRET = process.env.AUTH_SECRET || "dev-secret";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
}

export async function authenticate(email: string, password: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}

export function createToken(user: SessionUser): string {
  return jwt.sign(user, SECRET, { expiresIn: "24h" });
}

export function verifyToken(token: string): SessionUser | null {
  try {
    return jwt.verify(token, SECRET) as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requireRole(...roles: string[]): Promise<SessionUser> {
  const session = await requireSession();
  if (!roles.includes(session.role)) throw new Error("Forbidden");
  return session;
}

// Role hierarchy check
const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  manager: 80,
  staff: 60,
  analyst: 40,
  viewer: 20,
};

export function hasMinRole(userRole: string, minRole: string): boolean {
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[minRole] ?? 999);
}
