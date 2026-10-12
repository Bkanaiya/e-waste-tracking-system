#!/usr/bin/env bash
#
# End-to-end API test: customer -> collector batch -> transporter -> recycler
# -> manufacturer -> public trace. Requires the backend running on :4000 and
# the Fabric network + DynamoDB up.
#
set -euo pipefail

API="${API:-http://localhost:4000/api}"

login_staff() {
    curl -s -X POST "$API/auth/staff/login" -H 'Content-Type: application/json' \
        --data "$(jq -nc --arg r "$1" --arg p "$2" '{role:$r,password:$p}')" | jq -r .token
}

echo "==================================================================="
echo " E-Waste API end-to-end test   ($API)"
echo "==================================================================="

echo ">>> [1/9] collector staff login"
COLLECTOR=$(login_staff collector collectorpw)
[ -n "$COLLECTOR" ] && [ "$COLLECTOR" != "null" ] && echo "    OK: collector token acquired"

echo ">>> [2/9] register a customer"
EMAIL="cust$(date +%s)@example.com"
REG=$(curl -s -X POST "$API/auth/register" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg n 'Asha Rao' --arg e "$EMAIL" --arg p '+91-9000000000' \
        '{name:$n,email:$e,phone:$p}')")
CUST=$(echo "$REG" | jq -r .token)
CID=$(echo "$REG" | jq -r .customer.customerId)
echo "    customer=$CID email=$EMAIL"

echo ">>> [3/9] customer submits two items"
for cat in Mobile Laptop; do
    curl -s -X POST "$API/ewaste" -H "Authorization: Bearer $CUST" -H 'Content-Type: application/json' \
        --data "$(jq -nc --arg c "$cat" --arg cp 'GreenPoint-1' \
            '{category:$c,condition:"Working",collectionPoint:$cp,weightKg:1.2}')" \
        | jq -r '"    submitted item " + .uuid + " (" + .category + ")"'
done

echo ">>> [4/9] collector finalizes the daily batch"
FIN=$(curl -s -X POST "$API/batches/finalize" -H "Authorization: Bearer $COLLECTOR" \
    -H 'Content-Type: application/json' --data '{}')
BATCH=$(echo "$FIN" | jq -r .batchId)
PAYLOAD=$(echo "$FIN" | jq -r .qr.payload)
echo "    batch=$BATCH status=$(echo "$FIN" | jq -r .status) items=$(echo "$FIN" | jq -r .itemCount)"

echo ">>> [5/9] transporter scans the QR (collector -> transporter)"
TRANS=$(login_staff transporter transporterpw)
R5=$(curl -s -X POST "$API/transfers/scan" -H "Authorization: Bearer $TRANS" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg q "$PAYLOAD" '{qr:$q}')")
echo "    status=$(echo "$R5" | jq -r .status) owner=$(echo "$R5" | jq -r .ownerRole)"
PAYLOAD=$(echo "$R5" | jq -r .qr.payload)

echo ">>> [6/9] recycler scans the QR (transporter -> recycler)"
REC=$(login_staff recycler recyclerpw)
R6=$(curl -s -X POST "$API/transfers/scan" -H "Authorization: Bearer $REC" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg q "$PAYLOAD" '{qr:$q}')")
echo "    status=$(echo "$R6" | jq -r .status) owner=$(echo "$R6" | jq -r .ownerRole)"
PAYLOAD=$(echo "$R6" | jq -r .qr.payload)

echo ">>> [7/9] manufacturer scans the QR (recycler -> manufacturer)"
MAN=$(login_staff manufacturer manufacturerpw)
R7=$(curl -s -X POST "$API/transfers/scan" -H "Authorization: Bearer $MAN" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg q "$PAYLOAD" '{qr:$q}')")
echo "    status=$(echo "$R7" | jq -r .status) owner=$(echo "$R7" | jq -r .ownerRole)"

echo ">>> [8/9] public provenance trace (no auth)"
curl -s "$API/trace/$BATCH" | jq '{batch:.batch, categories:(.items|map(.category)), provenance:(.provenance|map(.action))}'

echo ">>> [9/9] negative test: recycler replays a stale QR (must fail)"
curl -s -X POST "$API/transfers/scan" -H "Authorization: Bearer $REC" -H 'Content-Type: application/json' \
    --data "$(jq -nc --arg q "$PAYLOAD" '{qr:$q}')" | jq -c .

echo "==================================================================="
echo " API end-to-end test complete."
echo "==================================================================="
