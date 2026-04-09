ALTER TABLE "WorkspaceMember"
ADD COLUMN "customRoleId" TEXT;

CREATE INDEX "WorkspaceMember_customRoleId_idx"
ON "WorkspaceMember"("customRoleId");

ALTER TABLE "WorkspaceMember"
ADD CONSTRAINT "WorkspaceMember_customRoleId_fkey"
FOREIGN KEY ("customRoleId") REFERENCES "CustomRole"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
