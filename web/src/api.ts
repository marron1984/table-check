const API_BASE = "/api";

// MVP: スタッフIDはローカルストレージから取得
function getHeaders(): Record<string, string> {
  const staffId = localStorage.getItem("staffId") || "demo-staff";
  return {
    "Content-Type": "application/json",
    "X-Staff-Id": staffId,
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...options?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `API error ${res.status}`);
  }

  return res.json();
}

// --- Reservations ---
export function fetchTodayReservations(shopId?: string) {
  const params = shopId ? `?shopId=${shopId}` : "";
  return request<{ data: Reservation[]; count: number }>(`/reservations/today${params}`);
}

export function fetchReservation(id: string) {
  return request<{ data: ReservationDetail }>(`/reservations/${id}`);
}

// --- Customers ---
export function searchCustomers(q: string, tag?: string, page = 1) {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (tag) params.set("tag", tag);
  params.set("page", String(page));
  return request<{ data: Customer[]; pagination: Pagination }>(`/customers/search?${params}`);
}

export function fetchCustomer(id: string) {
  return request<{ data: CustomerDetail; mergedInto?: string }>(`/customers/${id}`);
}

export function updateCustomer(id: string, data: Record<string, unknown>) {
  return request<{ data: Customer }>(`/customers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

// --- Duplicates ---
export function fetchDuplicates(page = 1) {
  return request<{ data: DuplicateCandidate[]; pagination: Pagination }>(
    `/customers/duplicates/queue?page=${page}`
  );
}

export function mergeDuplicate(id: string) {
  return request<{ success: boolean }>(`/customers/duplicates/${id}/merge`, { method: "POST" });
}

export function rejectDuplicate(id: string) {
  return request<{ success: boolean }>(`/customers/duplicates/${id}/reject`, { method: "POST" });
}

// --- Tags ---
export function fetchTags() {
  return request<{ data: TagDefinition[] }>("/tags");
}

export function assignTag(tagId: string, customerId: string) {
  return request<{ data: unknown }>(`/tags/${tagId}/customers/${customerId}`, { method: "POST" });
}

export function removeTag(tagId: string, customerId: string) {
  return request<{ success: boolean }>(`/tags/${tagId}/customers/${customerId}`, { method: "DELETE" });
}

// --- Dashboard ---
export function fetchDashboardStats() {
  return request<{ data: DashboardStats }>("/dashboard/stats");
}

// --- Types ---
export interface Reservation {
  id: string;
  dateTime: string;
  partySize: number;
  status: string;
  courseName: string | null;
  tableLabel: string | null;
  occasion: string | null;
  shop: { id: string; name: string };
  customer: Customer | null;
  alerts: Alert[];
}

export interface ReservationDetail extends Reservation {
  specialRequests: string | null;
  internalMemo: string | null;
  companions: string | null;
  source: string | null;
  customer: CustomerDetail | null;
}

export interface Customer {
  id: string;
  lastName: string | null;
  firstName: string | null;
  lastNameKana: string | null;
  firstNameKana: string | null;
  phone: string | null;
  email: string | null;
  companyName: string | null;
  language: string | null;
  tags: CustomerTag[];
  _count?: { reservations: number };
}

export interface CustomerDetail extends Customer {
  allergies: string | null;
  dietaryRestrictions: string | null;
  preferences: string | null;
  internalNote: string | null;
  secretaryName: string | null;
  secretaryPhone: string | null;
  secretaryEmail: string | null;
  referrerName: string | null;
  conciergeName: string | null;
  conciergeSource: string | null;
  ltvScore: number | null;
  returnProbability90: number | null;
  returnProbability180: number | null;
  cancelRisk: number | null;
  profileCompleteness: number | null;
  lastVisitAt: string | null;
  reservations: Reservation[];
  memberships: Membership[];
  mergedFrom: { id: string; lastName: string | null; firstName: string | null }[];
}

export interface CustomerTag {
  id: string;
  assignedBy: string | null;
  tagDefinition: TagDefinition;
}

export interface TagDefinition {
  id: string;
  slug: string;
  label: string;
  labelJa: string;
  category: string;
  color: string | null;
  priority: number;
  _count?: { customerTags: number };
}

export interface Alert {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  alertType: string;
  message: string;
}

export interface Membership {
  id: string;
  tier: string;
  status: string;
  startDate: string;
  endDate: string | null;
}

export interface DuplicateCandidate {
  id: string;
  primaryId: string;
  secondaryId: string;
  confidenceScore: number;
  matchReasons: string;
  primary: Customer;
  secondary: Customer;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DashboardStats {
  todayReservations: number;
  totalCustomers: number;
  pendingDuplicates: number;
  recentNoShows: number;
  vipCount: number;
  avgProfileCompleteness: number;
  duplicateRate: number;
}
