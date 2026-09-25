import assert from "node:assert/strict";
import { test } from "node:test";
import { isMigrationFile, migrationName, pendingMigrations } from "./migration-plan.mjs";

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/0001_init.sql"), "0001_init.sql");
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("a file already applied does not re-apply", () => {
  assert.deepEqual(pendingMigrations(["/migrations/0001_init.sql"], ["0001_init.sql"]), []);
});

test("non-.sql entries are dropped", () => {
  assert.equal(isMigrationFile("README.md"), false);
  assert.deepEqual(pendingMigrations(["README.md"], []), []);
});
