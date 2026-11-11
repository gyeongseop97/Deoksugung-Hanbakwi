import { handleRoomRequest } from "../server/room-handler.mjs";

export default {
  fetch(request) {
    return handleRoomRequest(request);
  }
};
