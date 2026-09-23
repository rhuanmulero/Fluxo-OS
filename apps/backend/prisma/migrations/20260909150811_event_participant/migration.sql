-- CreateTable
CREATE TABLE "event_participant" (
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "event_participant_pkey" PRIMARY KEY ("event_id","user_id")
);

-- CreateIndex
CREATE INDEX "event_participant_user_id_idx" ON "event_participant"("user_id");

-- AddForeignKey
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participant" ADD CONSTRAINT "event_participant_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
