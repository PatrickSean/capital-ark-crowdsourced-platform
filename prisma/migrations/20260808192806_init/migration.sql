-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('WINRED', 'ANEDOT', 'ACTBLUE');

-- CreateEnum
CREATE TYPE "Jurisdiction" AS ENUM ('FEDERAL', 'STATE');

-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('PENDING', 'UNVERIFIED', 'COMPLETED', 'DECLINED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Party" AS ENUM ('REPUBLICAN', 'DEMOCRAT', 'INDEPENDENT', 'LIBERTARIAN', 'GREEN', 'OTHER');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('PLEDGE_CONFIRMED', 'TARGET_CREATED', 'GOAL_REACHED', 'MEMBER_JOINED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT true,
    "employer" TEXT,
    "occupation" TEXT,
    "city" TEXT,
    "state" VARCHAR(2),
    "zip" VARCHAR(10),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coalitions" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logo_url" TEXT,
    "tracking_prefix" VARCHAR(24) NOT NULL,
    "flat_tracking_tag" BOOLEAN NOT NULL DEFAULT false,
    "require_sign_in" BOOLEAN NOT NULL DEFAULT false,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coalitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coalition_members" (
    "id" UUID NOT NULL,
    "coalition_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "coalition_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "legal_name" TEXT,
    "party" "Party" NOT NULL,
    "office" TEXT NOT NULL,
    "state" VARCHAR(2),
    "district" TEXT,
    "bio" TEXT,
    "photo_url" TEXT,
    "donation_url" TEXT,
    "donation_url_verified_at" TIMESTAMP(3),
    "platform" "Platform",
    "website_url" TEXT,
    "official_profile_url" TEXT,
    "official_data_verified_at" TIMESTAMP(3),
    "jurisdiction" "Jurisdiction" NOT NULL DEFAULT 'FEDERAL',
    "committee_name" TEXT,
    "ncsbe_committee_id" TEXT,
    "fec_candidate_id" TEXT,
    "fec_committee_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fundraising_targets" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "coalition_id" UUID NOT NULL,
    "candidate_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "goal_cents" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "suggested_amounts" INTEGER[] DEFAULT ARRAY[2500, 5000, 10000, 25000]::INTEGER[],
    "status" "TargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fundraising_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pledges" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "confirmed_amount_cents" INTEGER,
    "ocr_amount_cents" INTEGER,
    "status" "PledgeStatus" NOT NULL DEFAULT 'PENDING',
    "tracking_tag_used" TEXT NOT NULL,
    "receipt_url" TEXT,
    "is_anonymous_at_pledge" BOOLEAN NOT NULL DEFAULT true,
    "attested_at" TIMESTAMP(3),
    "attestation_version" TEXT,
    "ip_hash" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pledges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_click_events" (
    "id" UUID NOT NULL,
    "pledge_id" UUID,
    "target_id" UUID NOT NULL,
    "user_id" UUID,
    "platform" "Platform" NOT NULL,
    "tracking_tag" TEXT NOT NULL,
    "generated_url" TEXT NOT NULL,
    "amount_cents" INTEGER,
    "referrer" TEXT,
    "ip_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_events" (
    "id" UUID NOT NULL,
    "coalition_id" UUID NOT NULL,
    "target_id" UUID,
    "actor_id" UUID,
    "type" "ActivityType" NOT NULL,
    "actor_label" TEXT,
    "amount_cents" INTEGER,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_is_anonymous_idx" ON "users"("is_anonymous");

-- CreateIndex
CREATE UNIQUE INDEX "coalitions_slug_key" ON "coalitions"("slug");

-- CreateIndex
CREATE INDEX "coalitions_created_by_id_idx" ON "coalitions"("created_by_id");

-- CreateIndex
CREATE INDEX "coalition_members_user_id_idx" ON "coalition_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coalition_members_coalition_id_user_id_key" ON "coalition_members"("coalition_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_slug_key" ON "candidates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_ncsbe_committee_id_key" ON "candidates"("ncsbe_committee_id");

-- CreateIndex
CREATE UNIQUE INDEX "candidates_fec_candidate_id_key" ON "candidates"("fec_candidate_id");

-- CreateIndex
CREATE INDEX "candidates_platform_idx" ON "candidates"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "fundraising_targets_slug_key" ON "fundraising_targets"("slug");

-- CreateIndex
CREATE INDEX "fundraising_targets_coalition_id_status_idx" ON "fundraising_targets"("coalition_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "fundraising_targets_coalition_id_candidate_id_key" ON "fundraising_targets"("coalition_id", "candidate_id");

-- CreateIndex
CREATE INDEX "pledges_target_id_status_idx" ON "pledges"("target_id", "status");

-- CreateIndex
CREATE INDEX "pledges_user_id_status_idx" ON "pledges"("user_id", "status");

-- CreateIndex
CREATE INDEX "pledges_status_created_at_idx" ON "pledges"("status", "created_at");

-- CreateIndex
CREATE INDEX "link_click_events_target_id_created_at_idx" ON "link_click_events"("target_id", "created_at");

-- CreateIndex
CREATE INDEX "activity_events_coalition_id_created_at_idx" ON "activity_events"("coalition_id", "created_at");

-- AddForeignKey
ALTER TABLE "coalitions" ADD CONSTRAINT "coalitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coalition_members" ADD CONSTRAINT "coalition_members_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "coalitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coalition_members" ADD CONSTRAINT "coalition_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraising_targets" ADD CONSTRAINT "fundraising_targets_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "coalitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraising_targets" ADD CONSTRAINT "fundraising_targets_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fundraising_targets" ADD CONSTRAINT "fundraising_targets_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "fundraising_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_pledge_id_fkey" FOREIGN KEY ("pledge_id") REFERENCES "pledges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "fundraising_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click_events" ADD CONSTRAINT "link_click_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_coalition_id_fkey" FOREIGN KEY ("coalition_id") REFERENCES "coalitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "fundraising_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
