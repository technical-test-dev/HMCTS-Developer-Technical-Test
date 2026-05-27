-- Rename the status scheme: TODO -> NOT_STARTED, DONE -> COMPLETED.
-- IN_PROGRESS is unchanged. Also changes the column default to NOT_STARTED.
-- Done via a table rebuild (Prisma's SQLite pattern) so the new default and the
-- migrated data land together.
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "dueDateTime" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Task" ("id", "title", "description", "status", "dueDateTime", "createdAt", "updatedAt")
SELECT
    "id",
    "title",
    "description",
    CASE "status"
        WHEN 'TODO' THEN 'NOT_STARTED'
        WHEN 'DONE' THEN 'COMPLETED'
        ELSE "status"
    END,
    "dueDateTime",
    "createdAt",
    "updatedAt"
FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
