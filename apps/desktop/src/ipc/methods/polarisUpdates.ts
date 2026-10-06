import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as PolarisUpdateInvite from "../../polaris/updates/PolarisUpdateInvite.ts";
import * as IpcChannels from "../channels.ts";
import { makeIpcMethod } from "../DesktopIpc.ts";

const UpdateInviteStateSchema = Schema.Struct({
  hasCode: Schema.Boolean,
  persistent: Schema.Boolean,
});

export const getUpdateInvite = makeIpcMethod({
  channel: IpcChannels.POLARIS_UPDATES_GET_INVITE_CHANNEL,
  payload: Schema.Void,
  result: UpdateInviteStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.updates.getInvite")(function* () {
    return yield* (yield* PolarisUpdateInvite.PolarisUpdateInvite).getState;
  }),
});

/** An empty value removes the code. */
export const setUpdateInvite = makeIpcMethod({
  channel: IpcChannels.POLARIS_UPDATES_SET_INVITE_CHANNEL,
  payload: Schema.String,
  result: UpdateInviteStateSchema,
  handler: Effect.fn("desktop.ipc.polaris.updates.setInvite")(function* (code) {
    return yield* (yield* PolarisUpdateInvite.PolarisUpdateInvite).setCode(code);
  }),
});
