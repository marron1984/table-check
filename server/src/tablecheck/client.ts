import { config } from "../config";
import { logger } from "../logger";
import type {
  TCCustomer,
  TCReservation,
  TCMembership,
  TCShop,
  TCListResponse,
} from "./types";

/**
 * TableCheck CRM API クライアント
 *
 * CRM APIは顧客・予約・会員などの関連データ取得の主経路。
 * Sync APIの通知を受けた後、このクライアントで該当オブジェクトを再取得する。
 */
export class TableCheckClient {
  private baseUrl: string;
  private apiKey: string;
  private apiSecret: string;
  private franchiseId: string;

  constructor() {
    this.baseUrl = config.tableCheck.apiBaseUrl;
    this.apiKey = config.tableCheck.apiKey;
    this.apiSecret = config.tableCheck.apiSecret;
    this.franchiseId = config.tableCheck.franchiseId;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const maxRetries = config.sync.maxRetries;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "X-API-Secret": this.apiSecret,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`TableCheck API error ${response.status}: ${body}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          const delay = config.sync.retryDelayMs * Math.pow(2, attempt);
          logger.warn(`TableCheck API retry ${attempt + 1}/${maxRetries}`, {
            path,
            error: lastError.message,
            retryInMs: delay,
          });
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  // ============================================================
  // Shop
  // ============================================================

  async listShops(): Promise<TCListResponse<TCShop>> {
    return this.request<TCListResponse<TCShop>>(
      `/franchises/${this.franchiseId}/shops`
    );
  }

  async getShop(shopId: string): Promise<TCShop> {
    return this.request<TCShop>(`/shops/${shopId}`);
  }

  // ============================================================
  // Customer
  // ============================================================

  async listCustomers(
    page = 1,
    perPage = 100,
    updatedSince?: string
  ): Promise<TCListResponse<TCCustomer>> {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
    };
    if (updatedSince) {
      params.updated_since = updatedSince;
    }
    return this.request<TCListResponse<TCCustomer>>(
      `/franchises/${this.franchiseId}/customers`,
      params
    );
  }

  async getCustomer(customerId: string): Promise<TCCustomer> {
    return this.request<TCCustomer>(`/customers/${customerId}`);
  }

  // ============================================================
  // Reservation
  // ============================================================

  async listReservations(
    shopId: string,
    page = 1,
    perPage = 100,
    updatedSince?: string
  ): Promise<TCListResponse<TCReservation>> {
    const params: Record<string, string> = {
      page: String(page),
      per_page: String(perPage),
    };
    if (updatedSince) {
      params.updated_since = updatedSince;
    }
    return this.request<TCListResponse<TCReservation>>(
      `/shops/${shopId}/reservations`,
      params
    );
  }

  async getReservation(reservationId: string): Promise<TCReservation> {
    return this.request<TCReservation>(`/reservations/${reservationId}`);
  }

  // ============================================================
  // Membership
  // ============================================================

  async listMemberships(
    page = 1,
    perPage = 100
  ): Promise<TCListResponse<TCMembership>> {
    return this.request<TCListResponse<TCMembership>>(
      `/franchises/${this.franchiseId}/memberships`,
      { page: String(page), per_page: String(perPage) }
    );
  }

  async getMembership(membershipId: string): Promise<TCMembership> {
    return this.request<TCMembership>(`/memberships/${membershipId}`);
  }
}

export const tableCheckClient = new TableCheckClient();
