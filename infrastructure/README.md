# Infrastructure

`compose.yaml` is the repository's single Compose definition. Its default profile remains the local development PostgreSQL service. The `selfhost` profile runs the university-owned web, API, PostgreSQL, migration and HTTPS reverse-proxy stack.

## Host prerequisites

- A Unix x86-64 host with Docker Engine and the Docker Compose v2 plugin. Images are built on the host. The stack has been deployed on Ubuntu 24.04 with 1 vCPU and 2 GB RAM plus a 4 GB swap file; add swap on hosts with 2 GB RAM or less. The cloud templates default to 4 GiB RAM. ARM64 builds are prepared in the Dockerfiles but have not been run on a real host.
- Public TCP 80 and 443 for HTTP, HTTPS and certificate issuance, and UDP 443 for HTTP/3. Do not publish PostgreSQL.
- A DNS A (or AAAA) record for the domain pointing at the host **before** the first start, so Caddy can obtain the Let's Encrypt certificate. `ACME_EMAIL` is the certificate account contact.

## Deploy

For self-hosting, copy `.env.selfhost.example` to `.env.selfhost` on the Unix server, set a unique lowercase `RAFIK_INSTANCE_ID`, unique random 64-character hex PostgreSQL/API passwords (`openssl rand -hex 32`), the public domain and `ACME_EMAIL`, then point DNS to the server. The instance ID names its Compose project and volumes, so choose a different value for each institution sharing one Docker host. Keep the service on a private network until the first person completes super-admin setup; that first account receives administrative access. Run `bash infrastructure/scripts/deploy.sh` to build and start the self-hosted stack; a first build takes several minutes on a small host. Inspect with `docker compose ... ps` and `logs -f api` (review logs before sharing). A healthy instance shows `db`, `api` and `web` as healthy and `caddy` running. `migrate` exits with code 0 after applying migrations. `file-ops` is a helper that the backup and restore scripts run on demand, so its exited status is expected. Caddy logs `certificate obtained successfully` once TLS is ready.

To update, take the paired backup below first, then check out the reviewed revision and rerun the deploy script: `git fetch --tags && git checkout vX.Y.Z && bash infrastructure/scripts/deploy.sh`. Do not keep local edits in the server checkout; they block updates and drift from the reviewed source. PostgreSQL stays on an internal Docker network. `bash infrastructure/scripts/backup.sh` makes a paired checksummed database/private-file backup; `bash infrastructure/scripts/restore.sh infrastructure/.env.selfhost <backup-directory>` restores that pair. The API is paused while these commands run. Backups need to be encrypted and copied to university-controlled off-host storage. Run the matching database migration once before restoring onto a clean instance. The founder accepts the earlier paired backup/restore verification. A disposable Unix update/rollback rehearsal and live alert delivery remain pre-production backlog items; see the [beta readiness and operator checklist](../docs/operations/release-checklist.md).

## Local development and cloud templates

For local development, use the root workspace commands (`npm run backend:start` and `npm run backend:stop`) so migrations and local service lifecycle stay consistent. Never use local sample identities or synthetic credentials for hosted deployments.

Optional single-VM Terraform starters for AWS, Google Cloud and Azure are listed in the [cloud deployment guide](cloud/README.md). They prepare the same Compose stack and have not been applied or verified against provider accounts.
