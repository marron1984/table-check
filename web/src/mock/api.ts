/**
 * Mock API - デモモード用
 * サーバー不要で全機能が動作する静的データAPI
 */
import type {
  Customer, CustomerDetail, Reservation, ReservationDetail,
  TagDefinition, DuplicateCandidate, DashboardStats, SyncState, Pagination,
} from "../api";
import {
  allCustomers, allReservations, todayReservations,
  tagDefinitions, duplicateCandidates, dashboardStats, syncStates,
  paginate,
} from "./data";

// small delay to simulate network
const delay = (ms = 100) => new Promise((r) => setTimeout(r, ms));

// ---- Reservations ----

export async function fetchTodayReservations(_shopId?: string): Promise<{ data: Reservation[]; count: number }> {
  await delay();
  const filtered = _shopId
    ? todayReservations.filter((r) => r.shop.id === _shopId)
    : todayReservations;
  return { data: filtered, count: filtered.length };
}

export async function fetchReservation(id: string): Promise<{ data: ReservationDetail }> {
  await delay();
  const r = allReservations.find((r) => r.id === id);
  if (!r) throw new Error("予約が見つかりません");

  // Attach full customer detail
  const customer = r.customer ? allCustomers.find((c) => c.id === r.customer!.id) ?? null : null;
  return {
    data: {
      ...r,
      customer: customer ? {
        ...customer,
        reservations: customer.reservations.slice(0, 10),
      } : null,
    },
  };
}

// ---- Customers ----

export async function searchCustomers(
  q: string,
  _tag?: string,
  page = 1,
): Promise<{ data: Customer[]; pagination: Pagination }> {
  await delay();
  const query = q.toLowerCase();
  const filtered = allCustomers.filter((c) => {
    if (!query) return true;
    const fields = [
      c.lastName, c.firstName, c.lastNameKana, c.firstNameKana,
      c.phone, c.email, c.companyName,
    ].filter(Boolean).map((f) => f!.toLowerCase());
    return fields.some((f) => f.includes(query));
  });
  return paginate(filtered, page);
}

export async function fetchCustomer(id: string): Promise<{ data: CustomerDetail; mergedInto?: string }> {
  await delay();
  const c = allCustomers.find((c) => c.id === id);
  if (!c) throw new Error("顧客が見つかりません");
  return { data: c };
}

export async function updateCustomer(id: string, data: Record<string, unknown>): Promise<{ data: Customer }> {
  await delay();
  const c = allCustomers.find((c) => c.id === id);
  if (!c) throw new Error("顧客が見つかりません");
  // Apply changes in-memory
  for (const [key, value] of Object.entries(data)) {
    (c as unknown as Record<string, unknown>)[key] = value;
  }
  return { data: c };
}

// ---- Duplicates ----

export async function fetchDuplicates(page = 1): Promise<{ data: DuplicateCandidate[]; pagination: Pagination }> {
  await delay();
  return paginate(duplicateCandidates, page);
}

export async function mergeDuplicate(_id: string): Promise<{ success: boolean }> {
  await delay(200);
  const idx = duplicateCandidates.findIndex((d) => d.id === _id);
  if (idx >= 0) duplicateCandidates.splice(idx, 1);
  return { success: true };
}

export async function rejectDuplicate(_id: string): Promise<{ success: boolean }> {
  await delay(200);
  const idx = duplicateCandidates.findIndex((d) => d.id === _id);
  if (idx >= 0) duplicateCandidates.splice(idx, 1);
  return { success: true };
}

// ---- Tags ----

export async function fetchTags(): Promise<{ data: TagDefinition[] }> {
  await delay();
  return { data: tagDefinitions };
}

export async function assignTag(_tagId: string, _customerId: string): Promise<{ data: unknown }> {
  await delay();
  return { data: {} };
}

export async function removeTag(_tagId: string, _customerId: string): Promise<{ success: boolean }> {
  await delay();
  return { success: true };
}

// ---- Analytics (bulk customer detail) ----

export async function fetchAllCustomersDetail(): Promise<{ data: CustomerDetail[] }> {
  await delay();
  return { data: allCustomers };
}

// ---- Dashboard ----

export async function fetchDashboardStats(): Promise<{ data: DashboardStats }> {
  await delay();
  return { data: dashboardStats };
}

// ---- Sync ----

export async function fetchSyncStatus(): Promise<{ data: SyncState[] }> {
  await delay();
  return { data: syncStates };
}

export async function triggerBackfill(): Promise<{ message: string }> {
  await delay(500);
  // Update sync state timestamps
  const now = new Date().toISOString();
  for (const s of syncStates) {
    s.lastSyncAt = now;
    s.status = "idle";
  }
  return { message: "デモ環境: 同期ステータスを更新しました" };
}

// ---- Export (reuses search) ----

export async function exportCustomersCSV(q: string, tag?: string): Promise<{ data: Customer[]; pagination: Pagination }> {
  return searchCustomers(q, tag, 1);
}
