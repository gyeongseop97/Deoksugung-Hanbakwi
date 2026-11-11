import { createClient } from "@libsql/client/http";

export class DatabaseConfigurationError extends Error {}

export function openTursoClient(env = process.env) {
  const url = env.TURSO_DATABASE_URL?.trim();
  const authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) {
    throw new DatabaseConfigurationError("TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN을 설정해 주세요.");
  }
  try {
    return createClient({ url, authToken });
  } catch {
    throw new DatabaseConfigurationError("TURSO_DATABASE_URL 설정을 확인해 주세요.");
  }
}

export function adaptDatabase(client) {
  const result = ({ rows }) => ({ results: rows });
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return { sql, args, all: async () => result(await client.execute({ sql, args })) };
        }
      };
    },
    async batch(statements) {
      const queries = statements.map(({ sql, args }) => ({ sql, args }));
      const mode = queries.every(({ sql }) => /^\s*SELECT\b/i.test(sql)) ? "read" : "write";
      return (await client.batch(queries, mode)).map(result);
    }
  };
}

let database;
export function getTursoDatabase() {
  return database ??= adaptDatabase(openTursoClient());
}
