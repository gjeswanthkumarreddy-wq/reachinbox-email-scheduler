import test from "node:test";
import assert from "node:assert";
import { parse } from "csv-parse/sync";

test("CSV parser handles valid formatting", () => {
  const csv = `email,name\ntest@example.com,John Doe\ninvalid-email,Jane\n`;
  const records = parse(csv, { columns: true, skip_empty_lines: true, trim: true });
  assert.strictEqual(records.length, 2);
  assert.strictEqual(records[0].email, "test@example.com");
  assert.strictEqual(records[0].name, "John Doe");
});
