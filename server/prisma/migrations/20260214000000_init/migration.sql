-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('PENDING', 'MERGED', 'REJECTED');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'MANAGER', 'RESERVATION_STAFF', 'FLOOR_STAFF', 'ANALYST');

-- CreateTable
CREATE TABLE "franchises" (
    "id" TEXT NOT NULL,
    "tablecheck_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "franchises_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" TEXT NOT NULL,
    "tablecheck_id" TEXT NOT NULL,
    "franchise_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tokyo',
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "tablecheck_id" TEXT,
    "merged_into_id" TEXT,
    "last_name" TEXT,
    "first_name" TEXT,
    "last_name_kana" TEXT,
    "first_name_kana" TEXT,
    "last_name_en" TEXT,
    "first_name_en" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "phone_normalized" TEXT,
    "language" TEXT DEFAULT 'ja',
    "country" TEXT,
    "allergies" TEXT,
    "dietary_restrictions" TEXT,
    "preferences" TEXT,
    "internal_note" TEXT,
    "company_name" TEXT,
    "company_role" TEXT,
    "secretary_name" TEXT,
    "secretary_phone" TEXT,
    "secretary_email" TEXT,
    "referrer_name" TEXT,
    "concierge_name" TEXT,
    "concierge_source" TEXT,
    "ltv_score" DOUBLE PRECISION,
    "return_probability_90" DOUBLE PRECISION,
    "return_probability_180" DOUBLE PRECISION,
    "cancel_risk" DOUBLE PRECISION,
    "profile_completeness" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_visit_at" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_history" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservations" (
    "id" TEXT NOT NULL,
    "tablecheck_id" TEXT,
    "shop_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "date_time" TIMESTAMP(3) NOT NULL,
    "party_size" INTEGER NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "course_name" TEXT,
    "course_price" INTEGER,
    "total_amount" INTEGER,
    "table_label" TEXT,
    "occasion" TEXT,
    "special_requests" TEXT,
    "internal_memo" TEXT,
    "companions" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reservations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag_definitions" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_ja" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6B7280',
    "auto_rule" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tag_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "tag_definition_id" TEXT NOT NULL,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "metadata" TEXT,

    CONSTRAINT "customer_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "tablecheck_id" TEXT,
    "customer_id" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_alerts" (
    "id" TEXT NOT NULL,
    "reservation_id" TEXT NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "alert_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "duplicate_candidates" (
    "id" TEXT NOT NULL,
    "primary_id" TEXT NOT NULL,
    "secondary_id" TEXT NOT NULL,
    "confidence_score" DOUBLE PRECISION NOT NULL,
    "match_reasons" TEXT NOT NULL,
    "status" "DuplicateStatus" NOT NULL DEFAULT 'PENDING',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_states" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "last_sync_at" TIMESTAMP(3),
    "last_cursor" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "error_message" TEXT,
    "records_synced" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source_payload" TEXT,
    "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'FLOOR_STAFF',
    "shop_ids" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT,
    "action" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT,
    "customer_id" TEXT,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "franchises_tablecheck_id_key" ON "franchises"("tablecheck_id");

-- CreateIndex
CREATE UNIQUE INDEX "shops_tablecheck_id_key" ON "shops"("tablecheck_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_tablecheck_id_key" ON "customers"("tablecheck_id");

-- CreateIndex
CREATE INDEX "customers_phone_normalized_idx" ON "customers"("phone_normalized");

-- CreateIndex
CREATE INDEX "customers_email_idx" ON "customers"("email");

-- CreateIndex
CREATE INDEX "customers_last_name_first_name_idx" ON "customers"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "customers_last_name_kana_first_name_kana_idx" ON "customers"("last_name_kana", "first_name_kana");

-- CreateIndex
CREATE INDEX "customers_merged_into_id_idx" ON "customers"("merged_into_id");

-- CreateIndex
CREATE INDEX "customer_history_customer_id_changed_at_idx" ON "customer_history"("customer_id", "changed_at");

-- CreateIndex
CREATE UNIQUE INDEX "reservations_tablecheck_id_key" ON "reservations"("tablecheck_id");

-- CreateIndex
CREATE INDEX "reservations_shop_id_date_time_idx" ON "reservations"("shop_id", "date_time");

-- CreateIndex
CREATE INDEX "reservations_customer_id_idx" ON "reservations"("customer_id");

-- CreateIndex
CREATE INDEX "reservations_status_idx" ON "reservations"("status");

-- CreateIndex
CREATE INDEX "reservations_date_time_idx" ON "reservations"("date_time");

-- CreateIndex
CREATE UNIQUE INDEX "tag_definitions_slug_key" ON "tag_definitions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_customer_id_tag_definition_id_key" ON "customer_tags"("customer_id", "tag_definition_id");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_tablecheck_id_key" ON "memberships"("tablecheck_id");

-- CreateIndex
CREATE INDEX "memberships_customer_id_idx" ON "memberships"("customer_id");

-- CreateIndex
CREATE INDEX "reservation_alerts_reservation_id_idx" ON "reservation_alerts"("reservation_id");

-- CreateIndex
CREATE INDEX "duplicate_candidates_status_idx" ON "duplicate_candidates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "duplicate_candidates_primary_id_secondary_id_key" ON "duplicate_candidates"("primary_id", "secondary_id");

-- CreateIndex
CREATE UNIQUE INDEX "sync_states_object_type_key" ON "sync_states"("object_type");

-- CreateIndex
CREATE INDEX "sync_logs_object_type_applied_at_idx" ON "sync_logs"("object_type", "applied_at");

-- CreateIndex
CREATE INDEX "sync_logs_object_id_idx" ON "sync_logs"("object_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "audit_logs_staff_id_created_at_idx" ON "audit_logs"("staff_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_customer_id_idx" ON "audit_logs"("customer_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_franchise_id_fkey" FOREIGN KEY ("franchise_id") REFERENCES "franchises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_history" ADD CONSTRAINT "customer_history_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_tags" ADD CONSTRAINT "customer_tags_tag_definition_id_fkey" FOREIGN KEY ("tag_definition_id") REFERENCES "tag_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_alerts" ADD CONSTRAINT "reservation_alerts_reservation_id_fkey" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_primary_id_fkey" FOREIGN KEY ("primary_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "duplicate_candidates" ADD CONSTRAINT "duplicate_candidates_secondary_id_fkey" FOREIGN KEY ("secondary_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

