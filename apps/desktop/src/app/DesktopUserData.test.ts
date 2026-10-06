import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

import { resolveUserDataPath } from "./DesktopUserData.ts";

it.effect.each(["darwin", "win32", "linux"] as const)(
  "uses the Polaris profile on %s and never touches T3 Code's",
  (platform) =>
    Effect.gen(function* () {
      const production = yield* resolveUserDataPath({
        appDataDirectory: "/profiles",
        isDevelopment: false,
        platform,
      });
      const development = yield* resolveUserDataPath({
        appDataDirectory: "/profiles",
        isDevelopment: true,
        platform,
      });
      assert.equal(production, "/profiles/polaris");
      assert.equal(development, "/profiles/polaris-dev");
    }).pipe(
      // Any file system call fails the test: T3 Code's `t3code-v2`, `t3code`
      // and `T3 Code (Alpha)` folders are never inspected, read or copied.
      Effect.provideService(
        FileSystem.FileSystem,
        FileSystem.makeNoop({
          exists: () => Effect.die("inspected another profile"),
          readFileString: () => Effect.die("read another profile"),
        }),
      ),
      Effect.provide(NodeServices.layer),
    ),
);
