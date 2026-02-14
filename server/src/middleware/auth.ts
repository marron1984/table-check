import { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { StaffRole } from "@prisma/client";

// JWT簡易実装（本番ではjsonwebtokenライブラリを使用）
// MVP段階ではヘッダーからstaff IDを取得するシンプルな認証
export interface AuthenticatedRequest extends Request {
  staff?: {
    id: string;
    email: string;
    name: string;
    role: StaffRole;
    shopIds: string[];
  };
}

/**
 * 認証ミドルウェア
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const staffId = req.headers["x-staff-id"] as string;

  if (!staffId) {
    res.status(401).json({ error: "認証が必要です" });
    return;
  }

  const staff = await prisma.staff.findUnique({ where: { id: staffId } });
  if (!staff || !staff.isActive) {
    res.status(401).json({ error: "無効なスタッフアカウントです" });
    return;
  }

  req.staff = {
    id: staff.id,
    email: staff.email,
    name: staff.name,
    role: staff.role,
    shopIds: staff.shopIds ? JSON.parse(staff.shopIds) : [],
  };

  next();
}

/**
 * ロールベースアクセス制御ミドルウェア
 */
export function requireRole(...roles: StaffRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.staff) {
      res.status(401).json({ error: "認証が必要です" });
      return;
    }
    if (!roles.includes(req.staff.role)) {
      res.status(403).json({ error: "権限がありません" });
      return;
    }
    next();
  };
}
