/**
 * 同期処理コア
 * SyncEventを処理し、顧客/予約をUpsert、MergeCandidateを生成
 */
import { prisma } from "./prisma";
import { fetchCustomer, fetchReservation, type TCCustomer, type TCReservation } from "./tablecheck";
import { normalizePhone, normalizeEmail, normalizeName, nameSimilarity } from "./normalize";

const MAX_ATTEMPTS = 5;
const MERGE_NAME_THRESHOLD = 0.7;

// ============================================================
// Process pending sync events
// ============================================================
export async function processPendingEvents(batchSize = 20): Promise<{ processed: number; failed: number }> {
  const events = await prisma.syncEvent.findMany({
    where: { status: "pending", attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: batchSize,
  });

  let processed = 0;
  let failed = 0;

  for (const event of events) {
    // Mark as processing
    await prisma.syncEvent.update({
      where: { id: event.id },
      data: { status: "processing", attempts: event.attempts + 1 },
    });

    try {
      if (event.objectType === "customer") {
        await processCustomerEvent(event.objectId);
      } else if (event.objectType === "reservation") {
        await processReservationEvent(event.objectId);
      }

      await prisma.syncEvent.update({
        where: { id: event.id },
        data: { status: "processed", processedAt: new Date() },
      });
      processed++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const newStatus = event.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending";
      await prisma.syncEvent.update({
        where: { id: event.id },
        data: { status: newStatus, lastError: errorMsg.slice(0, 500) },
      });
      failed++;
    }
  }

  return { processed, failed };
}

// ============================================================
// Process a customer event
// ============================================================
async function processCustomerEvent(externalId: string): Promise<void> {
  const tcCustomer = await fetchCustomer(externalId);
  await upsertCustomer(tcCustomer);
}

// ============================================================
// Process a reservation event
// ============================================================
async function processReservationEvent(externalId: string): Promise<void> {
  const tcReservation = await fetchReservation(externalId);
  await upsertReservation(tcReservation);
}

// ============================================================
// Upsert Customer (idempotent)
// ============================================================
export async function upsertCustomer(tc: TCCustomer): Promise<string> {
  const phoneNorm = normalizePhone(tc.phone);
  const emailNorm = normalizeEmail(tc.email);
  const displayName = normalizeName(`${tc.last_name} ${tc.first_name}`.trim());
  const kanaName = tc.last_name_kana || tc.first_name_kana
    ? normalizeName(`${tc.last_name_kana || ""} ${tc.first_name_kana || ""}`.trim())
    : null;

  // Check if we already have this source
  const existingSource = await prisma.customerSource.findUnique({
    where: { externalId: tc.id },
    include: { customer: true },
  });

  if (existingSource) {
    // Update existing canonical customer
    await prisma.customer.update({
      where: { id: existingSource.customerId },
      data: {
        displayName,
        kanaName,
        email: tc.email,
        emailNormalized: emailNorm,
        phone: tc.phone,
        phoneNormalized: phoneNorm,
        locale: tc.locale,
      },
    });
    // Update source raw payload
    await prisma.customerSource.update({
      where: { id: existingSource.id },
      data: { rawPayload: JSON.stringify(tc) },
    });
    return existingSource.customerId;
  }

  // Try to find existing canonical customer by phone or email
  const resolvedCustomerId = await resolveIdentity(phoneNorm, emailNorm, displayName);

  if (resolvedCustomerId) {
    // Link source to existing customer
    await prisma.customerSource.create({
      data: {
        externalId: tc.id,
        customerId: resolvedCustomerId,
        rawPayload: JSON.stringify(tc),
      },
    });
    return resolvedCustomerId;
  }

  // Create new canonical customer + source
  const customer = await prisma.customer.create({
    data: {
      displayName,
      kanaName,
      email: tc.email,
      emailNormalized: emailNorm,
      phone: tc.phone,
      phoneNormalized: phoneNorm,
      locale: tc.locale,
      sources: {
        create: {
          externalId: tc.id,
          rawPayload: JSON.stringify(tc),
        },
      },
    },
  });

  // Check for potential merges with existing customers
  await checkForMergeCandidates(customer.id, phoneNorm, emailNorm, displayName);

  return customer.id;
}

// ============================================================
// Upsert Reservation (idempotent)
// ============================================================
export async function upsertReservation(tc: TCReservation): Promise<string> {
  // Ensure store exists
  const store = await prisma.store.upsert({
    where: { externalId: tc.shop_id },
    create: { externalId: tc.shop_id, name: `Shop ${tc.shop_id}`, slug: tc.shop_id },
    update: {},
  });

  // Ensure customer source exists (fetch if needed)
  let customerSource = await prisma.customerSource.findUnique({
    where: { externalId: tc.customer_id },
  });

  if (!customerSource) {
    // Fetch customer from TableCheck and upsert
    try {
      const tcCustomer = await fetchCustomer(tc.customer_id);
      const customerId = await upsertCustomer(tcCustomer);
      customerSource = await prisma.customerSource.findUnique({
        where: { externalId: tc.customer_id },
      });
      if (!customerSource) {
        throw new Error(`CustomerSource not found after upsert for ${tc.customer_id}`);
      }
    } catch {
      // If we can't fetch the customer, create a placeholder
      const placeholder = await prisma.customer.create({
        data: {
          displayName: `顧客 ${tc.customer_id}`,
          sources: {
            create: { externalId: tc.customer_id, rawPayload: "{}" },
          },
        },
      });
      customerSource = await prisma.customerSource.findUnique({
        where: { externalId: tc.customer_id },
      });
      if (!customerSource) {
        throw new Error("Failed to create placeholder customer source");
      }
    }
  }

  // Build flags
  const flags: Record<string, boolean> = {};
  const customer = await prisma.customer.findUnique({ where: { id: customerSource.customerId } });
  if (customer) {
    if (customer.allergySeverity === "severe") flags.severeAllergy = true;
    if (customer.noShowCount >= 2) flags.noShowRisk = true;
    if (customer.visitsCount >= 10) flags.vip = true;
  }

  // Map TC status to our status
  const statusMap: Record<string, string> = {
    confirmed: "confirmed",
    seated: "seated",
    completed: "completed",
    cancelled: "cancelled",
    no_show: "no_show",
  };

  const existing = await prisma.reservation.findUnique({
    where: { externalId: tc.id },
  });

  if (existing) {
    await prisma.reservation.update({
      where: { id: existing.id },
      data: {
        startsAt: new Date(tc.starts_at),
        partySize: tc.party_size,
        status: statusMap[tc.status] || tc.status,
        channel: tc.channel,
        courseName: tc.course_name,
        tableInfo: tc.table_name,
        flags: JSON.stringify(flags),
        rawPayload: JSON.stringify(tc),
      },
    });
    return existing.id;
  }

  const reservation = await prisma.reservation.create({
    data: {
      externalId: tc.id,
      storeId: store.id,
      customerId: customerSource.customerId,
      customerSourceId: customerSource.id,
      startsAt: new Date(tc.starts_at),
      partySize: tc.party_size,
      status: statusMap[tc.status] || tc.status,
      channel: tc.channel,
      courseName: tc.course_name,
      tableInfo: tc.table_name,
      flags: JSON.stringify(flags),
      rawPayload: JSON.stringify(tc),
    },
  });

  // Update customer stats
  await updateCustomerStats(customerSource.customerId);

  return reservation.id;
}

// ============================================================
// Identity Resolution
// ============================================================
async function resolveIdentity(
  phone: string | null,
  email: string | null,
  displayName: string,
): Promise<string | null> {
  // 1. Phone match (high confidence)
  if (phone) {
    const byPhone = await prisma.customer.findFirst({
      where: { phoneNormalized: phone, mergedIntoId: null, deletedAt: null },
    });
    if (byPhone) return byPhone.id;
  }

  // 2. Email match (high confidence)
  if (email) {
    const byEmail = await prisma.customer.findFirst({
      where: { emailNormalized: email, mergedIntoId: null, deletedAt: null },
    });
    if (byEmail) return byEmail.id;
  }

  // Name-only matches are ambiguous → will be handled by checkForMergeCandidates
  return null;
}

// ============================================================
// Check for merge candidates
// ============================================================
async function checkForMergeCandidates(
  customerId: string,
  phone: string | null,
  email: string | null,
  displayName: string,
): Promise<void> {
  const candidates = await prisma.customer.findMany({
    where: {
      id: { not: customerId },
      mergedIntoId: null,
      deletedAt: null,
    },
    take: 200, // limit scope
  });

  for (const other of candidates) {
    const reasons: string[] = [];
    let score = 0;

    // Phone match (already handled in resolveIdentity, but check cross-source)
    if (phone && other.phoneNormalized === phone) {
      reasons.push("phone_match");
      score = Math.max(score, 0.95);
    }

    // Email match
    if (email && other.emailNormalized === email) {
      reasons.push("email_match");
      score = Math.max(score, 0.9);
    }

    // Name similarity
    if (displayName && other.displayName) {
      const sim = nameSimilarity(displayName, other.displayName);
      if (sim >= MERGE_NAME_THRESHOLD) {
        reasons.push(`name_similar:${sim.toFixed(2)}`);
        score = Math.max(score, sim * 0.6);
      }
    }

    if (reasons.length === 0) continue;

    // Avoid duplicate merge candidates
    const existing = await prisma.mergeCandidate.findFirst({
      where: {
        OR: [
          { customerAId: customerId, customerBId: other.id },
          { customerAId: other.id, customerBId: customerId },
        ],
      },
    });

    if (!existing) {
      await prisma.mergeCandidate.create({
        data: {
          customerAId: customerId,
          customerBId: other.id,
          score,
          reasons: JSON.stringify(reasons),
          status: "pending",
        },
      });
    }
  }
}

// ============================================================
// Update customer aggregate stats
// ============================================================
export async function updateCustomerStats(customerId: string): Promise<void> {
  const reservations = await prisma.reservation.findMany({
    where: { customerId, deletedAt: null },
    orderBy: { startsAt: "desc" },
  });

  const completed = reservations.filter((r) => r.status === "completed" || r.status === "seated");
  const cancelled = reservations.filter((r) => r.status === "cancelled");
  const noShow = reservations.filter((r) => r.status === "no_show");

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      visitsCount: completed.length,
      lastVisitAt: completed[0]?.startsAt ?? null,
      cancelCount: cancelled.length,
      noShowCount: noShow.length,
    },
  });
}
