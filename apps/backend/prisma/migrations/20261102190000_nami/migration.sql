CREATE TABLE "nami_settings" (
  "user_id" TEXT NOT NULL, "encrypted_key" TEXT NOT NULL, "model" TEXT NOT NULL DEFAULT 'gemini-3.5-flash-lite',
  CONSTRAINT "nami_settings_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "nami_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "nami_conversation" (
  "id" TEXT NOT NULL, "user_id" TEXT NOT NULL, "title" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "nami_conversation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nami_conversation_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "nami_conversation_user_id_updated_at_idx" ON "nami_conversation"("user_id", "updated_at");
CREATE TABLE "nami_message" (
  "id" TEXT NOT NULL, "conversation_id" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "position" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "nami_message_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "nami_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "nami_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "nami_message_conversation_id_position_key" ON "nami_message"("conversation_id", "position");
