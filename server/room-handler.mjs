import { api } from "../room.mjs";
import { DatabaseConfigurationError, getTursoDatabase } from "./database.mjs";
import { GITHUB_PAGES_ORIGIN } from "../public/hosting.js";

export async function handleRoomRequest(request, getDatabase = getTursoDatabase) {
  const origin=request.headers.get("Origin"),fromPages=origin===GITHUB_PAGES_ORIGIN;
  if(request.method==="OPTIONS")return roomPreflight(request,fromPages);
  let response;
  try {
    response=await api(request, { get DB() { return getDatabase(); } });
  } catch (error) {
    const configurationError = error instanceof DatabaseConfigurationError;
    if (!configurationError) console.error("Room database request failed", error.code ?? error.name);
    const message = configurationError ? error.message : "산책방 연결을 다시 시도해 주세요.";
    response=Response.json({ error: message }, {
      status: configurationError ? 503 : 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
  const headers=new Headers(response.headers);
  if(!headers.get("Vary")?.split(/\s*,\s*/).some(value=>value.toLowerCase()==="origin"))headers.append("Vary","Origin");
  if(fromPages)headers.set("Access-Control-Allow-Origin",GITHUB_PAGES_ORIGIN);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}

function roomPreflight(request,fromPages){
  const headers=new Headers({"Allow":"POST, OPTIONS","Vary":"Origin, Access-Control-Request-Method, Access-Control-Request-Headers"});
  const method=request.headers.get("Access-Control-Request-Method");
  const requested=(request.headers.get("Access-Control-Request-Headers")??"").split(/\s*,\s*/).filter(Boolean);
  if(fromPages&&(!method||method==="POST")&&requested.every(header=>header.toLowerCase()==="content-type")){
    headers.set("Access-Control-Allow-Origin",GITHUB_PAGES_ORIGIN);
    headers.set("Access-Control-Allow-Methods","POST, OPTIONS");
    headers.set("Access-Control-Allow-Headers","Content-Type");
    headers.set("Access-Control-Max-Age","86400");
    return new Response(null,{status:204,headers});
  }
  return new Response(null,{status:method?403:204,headers});
}
