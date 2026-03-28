CREATE TABLE IF NOT EXISTS "anonymous_usage" (
	"session_id" text PRIMARY KEY NOT NULL,
	"question_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
