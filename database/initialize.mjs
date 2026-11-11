import { readFile } from "node:fs/promises";

export async function initializeDatabase(client) {
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  const statements = schema.split(";").map(statement => statement.trim()).filter(Boolean);
  await client.batch(statements, "write");
}
