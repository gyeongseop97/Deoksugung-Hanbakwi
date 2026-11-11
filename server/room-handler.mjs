import { api } from "../room.mjs";
import { DatabaseConfigurationError, getTursoDatabase } from "./database.mjs";

export async function handleRoomRequest(request, getDatabase = getTursoDatabase) {
  try {
    return await api(request, { get DB() { return getDatabase(); } });
  } catch (error) {
    const configurationError = error instanceof DatabaseConfigurationError;
    if (!configurationError) console.error("Room database request failed", error.code ?? error.name);
    const message = configurationError ? error.message : "산책방 연결을 다시 시도해 주세요.";
    return Response.json({ error: message }, {
      status: configurationError ? 503 : 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}
