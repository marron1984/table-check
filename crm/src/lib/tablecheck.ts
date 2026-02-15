/**
 * TableCheck CRM API クライアント
 *
 * APIレスポンス形状は仮定。実際のレスポンスに合わせて差し替え可能。
 */

const BASE_URL = process.env.TABLECHECK_BASE_URL || "https://api.tablecheck.com/v2";
const API_KEY = process.env.TABLECHECK_API_KEY || "";
const WEBHOOK_SECRET = process.env.TABLECHECK_WEBHOOK_SECRET || "";

// ============================================================
// Types (仮定 - 実際のAPI仕様に合わせて差し替え)
// ============================================================
export interface TCCustomer {
  id: string;
  first_name: string;
  last_name: string;
  first_name_kana?: string;
  last_name_kana?: string;
  email?: string;
  phone?: string;
  locale?: string;
  notes?: string;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface TCReservation {
  id: string;
  shop_id: string;
  customer_id: string;
  starts_at: string;
  party_size: number;
  status: string; // confirmed | seated | completed | cancelled | no_show
  channel?: string;
  course_name?: string;
  table_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TCSyncEvent {
  event_type: string;   // reservation.created | reservation.updated | customer.updated etc.
  object_type: string;  // reservation | customer
  object_id: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface TCListResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  };
}

// ============================================================
// HTTP Client with retry
// ============================================================
async function tcFetch<T>(path: string, options?: RequestInit & { retries?: number }): Promise<T> {
  const retries = options?.retries ?? 3;
  const url = `${BASE_URL}${path}`;

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
    ...(options?.headers as Record<string, string> ?? {}),
  };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { ...options, headers });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status >= 500 && attempt < retries) {
          await sleep(Math.pow(2, attempt) * 1000);
          continue;
        }
        throw new Error(`TableCheck API ${res.status}: ${body.slice(0, 200)}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (attempt < retries && isRetryable(err)) {
        await sleep(Math.pow(2, attempt) * 1000);
        continue;
      }
      throw err;
    }
  }
  throw new Error("Max retries exceeded");
}

function isRetryable(err: unknown): boolean {
  if (err instanceof TypeError) return true; // network error
  if (err instanceof Error && err.message.includes("5")) return true;
  return false;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============================================================
// API Methods
// ============================================================

export async function fetchCustomer(customerId: string): Promise<TCCustomer> {
  return tcFetch<TCCustomer>(`/customers/${customerId}`);
}

export async function fetchReservation(reservationId: string): Promise<TCReservation> {
  return tcFetch<TCReservation>(`/reservations/${reservationId}`);
}

export async function listReservations(params: {
  shop_id?: string;
  since?: string;
  until?: string;
  page?: number;
  per_page?: number;
}): Promise<TCListResponse<TCReservation>> {
  const qs = new URLSearchParams();
  if (params.shop_id) qs.set("shop_id", params.shop_id);
  if (params.since) qs.set("since", params.since);
  if (params.until) qs.set("until", params.until);
  if (params.page) qs.set("page", String(params.page));
  qs.set("per_page", String(params.per_page || 100));
  return tcFetch<TCListResponse<TCReservation>>(`/reservations?${qs}`);
}

export async function listCustomers(params: {
  page?: number;
  per_page?: number;
  updated_since?: string;
}): Promise<TCListResponse<TCCustomer>> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.updated_since) qs.set("updated_since", params.updated_since);
  qs.set("per_page", String(params.per_page || 100));
  return tcFetch<TCListResponse<TCCustomer>>(`/customers?${qs}`);
}

// ============================================================
// Webhook Verification
// ============================================================
export function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  // Simple HMAC or shared-secret comparison
  // If TableCheck uses HMAC-SHA256, use crypto.createHmac
  // For MVP: simple secret header comparison
  return signature === WEBHOOK_SECRET;
}

// ============================================================
// Write-back stub (将来拡張ポイント - 未実装)
// ============================================================
export async function _updateCustomerInTableCheck(_id: string, _data: Partial<TCCustomer>): Promise<void> {
  throw new Error("Write-back to TableCheck is not implemented (by design)");
}
