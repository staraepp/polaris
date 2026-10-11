# Polaris server (Star's VPS)

The private side of Polaris, on the VPS reached as `ssh hostinger-vps`. Since V 4.7.0 it serves the **update feed**; V 5.0.0 adds collaboration (whiteboards, docs, chat) next to it.

| Piece                       | Where on the VPS                                                    | What it does                                                                          |
| --------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `polaris-updates` container | `/opt/polaris/docker-compose.yml`, listens on `127.0.0.1:3095` only | nginx: `/health` (public), `/updates/*` only with a valid `X-Polaris-Invite` header   |
| Public download links       | `/download/*` on the same container                                 | the installers only, no code needed (V 5.4.0); see "Download links" below             |
| Invite codes                | `/opt/polaris/nginx/invites.map` (never in git)                     | one `"<code>" 1;` line per code                                                       |
| Release files               | `/opt/polaris/updates/`                                             | `latest-mac.yml`, `latest.yml`, the dmg and exe (+ blockmaps), newest 3 versions      |
| Tunnel                      | `cloudflared-polaris.service`, `/etc/cloudflared/polaris.yml`       | its own tunnel `polaris` → `https://polaris.sstarvfx.com`; no other tunnel is touched |

The files in this folder are the source of truth for the container, nginx and tunnel config; copy them to the VPS after a change.

## Publish a release

After building the dmg and the exe in `release/` (see `AGENTS.md`, Packaging):

```sh
node scripts/polaris-publish-update.mjs --dry-run   # what would be uploaded
node scripts/polaris-publish-update.mjs             # upload the version in apps/desktop/package.json
```

Installers go up first and the `latest*.yml` lists last, so clients never see a version whose files are missing.

## Download links

Links to share with friends; they need no invite code and always serve the newest version:

- macOS: `https://polaris.sstarvfx.com/download/Polaris-mac.dmg`
- Windows: `https://polaris.sstarvfx.com/download/Polaris-windows.exe`

They are symlinks in `/opt/polaris/updates/` that the publish script points at each new version. A specific version is `/download/Polaris-<version>-arm64.dmg` or `/download/Polaris-<version>-x64.exe`. Nothing else is public under `/download/`: no `latest*.yml`, blockmaps or listing.

`default.conf` is bind-mounted as a single file, so after copying a new one run `docker restart polaris-updates` (a reload keeps reading the old file).

## Invite codes

Add a code: append `"<code>" 1;` to `/opt/polaris/nginx/invites.map`, then `docker exec polaris-updates nginx -s reload`. Remove a line and reload to revoke one. Codes must match `POLARIS_INVITE_CODE_PATTERN` (`packages/shared/src/polarisUpdateFeed.ts`): 8 to 64 letters, digits or dashes.

## How the app uses it

- The feed URL and header name live in `packages/shared/src/polarisUpdateFeed.ts`; the build bakes the URL in as electron-builder's generic publish target (`POLARIS_UPDATE_FEED=off` builds without it).
- The user enters the code in onboarding or Settings → General → Updates; the desktop main process encrypts it with `safeStorage` (`apps/desktop/src/polaris/updates/PolarisUpdateInvite.ts`).
- Windows: electron-updater, with the code as a request header, downloads and installs.
- macOS: Polaris is not signed with an Apple Developer ID, so the app cannot replace itself. `MacManualUpdater` downloads the dmg into Downloads, checks its sha512 against `latest-mac.yml`, then opens it and quits; the user drags Polaris into Applications.

## Checks

```sh
curl -s https://polaris.sstarvfx.com/health                                    # ok
curl -s -o /dev/null -w '%{http_code}\n' https://polaris.sstarvfx.com/updates/latest-mac.yml   # 401
curl -sI https://polaris.sstarvfx.com/download/Polaris-windows.exe | head -1         # 200
```

Cleanup still owed (2026-10-06): a mistaken DNS record `polaris.staraep.fun.sstarvfx.com` (CNAME to the `deepseek-harness` tunnel, which answers 404) was created during setup; delete it in the Cloudflare dashboard.
