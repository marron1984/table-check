import { Response, NextFunction } from "express";
import { prisma } from "../db";
import type { AuthenticatedRequest } from "./auth";

/**
 * 監査ログミドルウェア
 * GET以外のリクエストを自動記録
 */
export function auditLog(objectType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // レスポンス完了後にログを記録
    res.on("finish", async () => {
      if (req.method === "GET" && res.statusCode < 400) {
        // GEOは成功時のみ閲覧ログ（重要エンドポイントのみ）
        return;
      }

      try {
        await prisma.auditLog.create({
          data: {
            staffId: req.staff?.id || null,
            action: methodToAction(req.method),
            objectType,
            objectId: req.params.id || null,
            customerId: req.params.customerId || null,
            details: JSON.stringify({
              method: req.method,
              path: req.path,
              statusCode: res.statusCode,
              body: req.method !== "GET" ? req.body : undefined,
            }),
            ipAddress: req.ip || null,
          },
        });
      } catch {
        // 監査ログの失敗でリクエストを止めない
      }
    });

    next();
  };
}

function methodToAction(method: string): string {
  switch (method) {
    case "GET": return "view";
    case "POST": return "create";
    case "PUT": case "PATCH": return "edit";
    case "DELETE": return "delete";
    default: return method.toLowerCase();
  }
}
