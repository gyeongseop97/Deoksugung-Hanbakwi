import {handleProfileRequest} from "../server/profile-transfer.mjs";

export default {fetch(request){return handleProfileRequest(request);}};
