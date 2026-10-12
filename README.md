# E-Waste Tracking System

An e-waste collection and custody-tracking system built on **Hyperledger Fabric**.

Customers hand over electronic waste; a collector seals each day's items into a batch and
writes it to the ledger. Every subsequent custody hand-off
(**collector → transporter → recycler → manufacturer**) is recorded on-chain, and anyone
can verify a batch's full provenance without signing in.

---

## Architecture

```
                       +-----------------------------+
   Browser (React)     |  Vite dev server  :5173     |
   ------------------> |  (proxies /api -> :4000)    |
                       +--------------+--------------+
                                      |
                       +--------------v--------------+
                       |  Express API  :4000         |
                       |  - JWT auth (per role)      |
                       |  - Fabric Gateway client    |
                       +------+---------------+------+
                              |               |
                 +------------v---+   +-------v------------------+
                 | DynamoDB Local |   | Hyperledger Fabric       |
                 | :8000 (off-chain|  | test-network (mychannel) |
                 |  item details) |   | chaincode: ewaste        |
                 +----------------+   +--------------------------+
```

- **On-chain (minimal, tamper-proof):** batch id, date, item UUIDs, owner role/id,
  status, a rotating custody token, and full history.
- **Off-chain (DynamoDB):** customer records and the descriptive item fields
  (brand, model, condition, weight, collection point).
- **Custody token:** each transfer rotates a secret token embedded in the batch QR code.
  Only the current custodian can obtain the live token; a stale/duplicate QR is rejected
  by the chaincode.

### Roles

| Role         | Org   | Password        |
| ------------ | ----- | --------------- |
| customer     | -     | (email login)   |
| collector    | Org1  | `collectorpw`   |
| transporter  | Org1  | `transporterpw` |
| recycler     | Org2  | `recyclerpw`    |
| manufacturer | Org2  | `manufacturerpw`|

---

## Repository layout

```
ewaste/
  chaincode/ewaste-js/     Chaincode (JavaScript, fabric-contract-api)
  scripts/                 Network + test scripts (peer CLI)
  backend/                 Express REST API (Fabric Gateway + DynamoDB)
  frontend/                React (Vite) single-page app
  docker-compose.yml       DynamoDB Local
  start-all.sh             Starts DynamoDB + backend + frontend
  README.md
```

---

## Prerequisites

- **Docker Desktop** running on Windows (WSL has no `dockerd`; Fabric and DynamoDB run here).
- **WSL Ubuntu** with **Node.js >= 18**.
- **`fabric-samples`** checked out next to this project, with the test network already
  bootstrapped (crypto material under
  `../fabric-samples/test-network/organizations`).

---

## Quick start

### Step 1 - Start the Fabric network (once, and after each reboot)

```bash
cd ewaste
./scripts/setup-network.sh
```

This brings the test network up, enrolls the four role identities, and deploys the
`ewaste` chaincode. If the chaincode commit step is flaky under load, retry just that part:

```bash
./scripts/deploy-chaincode.sh
```

### Step 2 - Start DynamoDB, the backend and the frontend

```bash
cd ewaste
./start-all.sh
```

Then open **http://localhost:5173**.

`start-all.sh` is idempotent: it starts whatever is not already running and re-creates the
DynamoDB tables (safe to re-run). It prints the URLs and credentials when done.

<details>
<summary>Manual equivalent</summary>

```bash
cd ewaste
docker compose up -d                 # DynamoDB Local on :8000
cd backend
npm install                          # first time only
npm run db:init                      # create tables
npm start                            # API on :4000
# in another terminal:
cd ewaste/frontend
npm install                          # first time only
npm run dev                          # UI on :5173
```
</details>

---

## Using the app

| Portal       | URL path                  |
| ------------ | ------------------------- |
| Home         | `/`                       |
| Customer     | `/login/customer`         |
| Collector    | `/login/collector`        |
| Transporter  | `/login/transporter`      |
| Recycler     | `/login/recycler`         |
| Manufacturer | `/login/manufacturer`     |
| Public trace | `/trace`                  |

Typical walkthrough:

1. **Customer** registers (any email) and submits one or more e-waste items.
2. **Collector** clicks *Finalize today's batch* - this writes the batch on-chain and
   shows a QR code.
3. **Transporter** scans (or pastes) that QR to take custody; a new QR is produced.
4. **Recycler**, then **Manufacturer**, repeat the scan. After the manufacturer takes
   custody the batch is fully traced.
5. Open **`/trace/<batchId>`** - no login required - to see the provenance timeline.

Camera scanning needs a secure context and permission; on desktop, paste the QR payload
text into the manual field instead.

---

## API summary

Base URL: `http://localhost:4000/api`

| Method | Path                       | Auth            | Purpose                                  |
| ------ | -------------------------- | --------------- | ---------------------------------------- |
| POST   | `/auth/register`           | -               | Register a customer, returns JWT         |
| POST   | `/auth/login`              | -               | Customer sign-in by email                |
| POST   | `/auth/staff/login`        | -               | Staff sign-in by `{ role, password }`    |
| GET    | `/ewaste/categories`       | -               | Supported categories                     |
| POST   | `/ewaste`                  | customer        | Submit an e-waste item                   |
| GET    | `/ewaste/mine`             | customer        | List my items                            |
| GET    | `/ewaste/:uuid`            | customer/staff  | Item detail                              |
| POST   | `/batches/finalize`        | collector       | Seal the day's items into a batch        |
| GET    | `/batches`                 | staff           | Batches I own (`?scope=all` for all)     |
| GET    | `/batches/:id`             | any auth        | Batch detail (QR only for the owner)     |
| GET    | `/batches/:id/qr`          | current owner   | The live custody QR for the owner        |
| POST   | `/transfers/scan`          | staff           | `{ qr }` -> take custody                 |
| GET    | `/trace/:batchId`          | -               | Public provenance (never exposes token)  |

Chaincode functions: `CreateBatch`, `ReadBatch`, `TransferBatch`, plus read queries.

---

## Tests / verification scripts

```bash
cd ewaste
./scripts/smoke-test.sh     # peer-CLI end-to-end on-chain flow + negative test
./scripts/api-e2e.sh        # full HTTP flow through the backend
./scripts/register-roles.sh # (re)enroll the four role identities
```

---

## Stopping

```bash
cd ewaste
docker compose down                        # stop DynamoDB
pkill -f "src/server.js"                   # stop backend
pkill -f "vite"                            # stop frontend
cd ../fabric-samples/test-network
./network.sh down                          # stop Fabric
```

---

## Troubleshooting

- **`docker: command not found` / cannot connect:** start **Docker Desktop** first and wait
  until it reports the engine is running.
- **Backend starts but finalize/scan fails:** the Fabric network is not up. Run
  `./scripts/setup-network.sh` (peer should be listening on `:7051`).
- **DynamoDB errors / empty tables:** `docker compose up -d` then `cd backend && npm run db:init`.
  DynamoDB Local runs in-memory here, so tables are recreated on every container start.
- **Fabric `context deadline exceeded` / `too_many_pings` under load:** the machine is
  resource-constrained; re-run `./scripts/deploy-chaincode.sh`, which retries with longer
  timeouts.
- **Camera scan does nothing:** browsers require HTTPS or `localhost` for camera access,
  and no device may exist on a server. Use the manual paste field.
