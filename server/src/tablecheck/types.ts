// ============================================================
// TableCheck API レスポンス型定義
// ============================================================

export interface TCPagination {
  page: number;
  per_page: number;
  total_count: number;
  total_pages: number;
}

export interface TCListResponse<T> {
  data: T[];
  pagination: TCPagination;
}

// --- Shop ---
export interface TCShop {
  id: string;
  name: string;
  timezone: string;
  phone?: string;
  address?: string;
  franchise_id: string;
}

// --- Customer ---
export interface TCCustomer {
  id: string;
  last_name?: string;
  first_name?: string;
  last_name_kana?: string;
  first_name_kana?: string;
  last_name_en?: string;
  first_name_en?: string;
  email?: string;
  phone?: string;
  language?: string;
  country?: string;
  company_name?: string;
  company_role?: string;
  allergies?: string;
  dietary_restrictions?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// --- Reservation ---
export interface TCReservation {
  id: string;
  shop_id: string;
  customer_id?: string;
  date_time: string;
  party_size: number;
  status: string;
  course_name?: string;
  course_price?: number;
  total_amount?: number;
  table_label?: string;
  occasion?: string;
  special_requests?: string;
  memo?: string;
  companions?: string;
  cancelled_at?: string;
  cancel_reason?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

// --- Membership ---
export interface TCMembership {
  id: string;
  customer_id: string;
  tier: string;
  status: string;
  start_date: string;
  end_date?: string;
}

// --- Sync Event ---
export interface TCSyncEvent {
  id: string;
  object_type: "customer" | "reservation" | "membership" | "shop";
  object_id: string;
  action: "create" | "update" | "delete";
  timestamp: string;
}
