#!/usr/bin/env bash
#
# End-to-end smoke test driving the ewaste chaincode through all four roles
# with the peer CLI. Validates ABAC (role attributes) and the custody chain:
#   collector -> transporter -> recycler -> manufacturer
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="${SCRIPT_DIR}/../../fabric-samples/test-network"
export PATH="${SCRIPT_DIR}/../../fabric-samples/bin:${PATH}"
export FABRIC_CFG_PATH="${SCRIPT_DIR}/../../fabric-samples/config"
cd "${NETWORK_DIR}"

ORG1="${NETWORK_DIR}/organizations/peerOrganizations/org1.example.com"
ORG2="${NETWORK_DIR}/organizations/peerOrganizations/org2.example.com"
ORDERER_CA="${NETWORK_DIR}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"
ORG1_CA="${ORG1}/tlsca/tlsca.org1.example.com-cert.pem"
ORG2_CA="${ORG2}/tlsca/tlsca.org2.example.com-cert.pem"
CHANNEL=mychannel
CCN=ewaste

TODAY=$(date +%d-%m-%Y)
RUN=$(date +%H%M%S)
BATCH="BATCH-${TODAY}-${RUN}"
UUIDS='["uuid-smoke-1111","uuid-smoke-2222"]'

use_identity() {
    local org="$1" user="$2" port="$3" mspid="$4" ca="$5"
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID="${mspid}"
    export CORE_PEER_TLS_ROOTCERT_FILE="${ca}"
    export CORE_PEER_MSPCONFIGPATH="${NETWORK_DIR}/organizations/peerOrganizations/${org}.example.com/users/${user}@${org}.example.com/msp"
    export CORE_PEER_ADDRESS="localhost:${port}"
}

invoke() {
    local payload="$1"
    peer chaincode invoke -o localhost:7050 --ordererTLSHostnameOverride orderer.example.com \
        --tls --cafile "${ORDERER_CA}" -C "${CHANNEL}" -n "${CCN}" \
        --peerAddresses localhost:7051 --tlsRootCertFiles "${ORG1_CA}" \
        --peerAddresses localhost:9051 --tlsRootCertFiles "${ORG2_CA}" \
        -c "${payload}"
}

query() {
    local payload="$1"
    peer chaincode query -C "${CHANNEL}" -n "${CCN}" -c "${payload}"
}

snapshot() {
    # Poll until the batch reaches the expected status; commit (and the state
    # visible to a query) can lag well behind the invoke under load.
    local expected="$1" payload attempt out status
    payload=$(jq -nc --arg b "${BATCH}" '{function:"ReadBatch",Args:[$b]}')
    for attempt in $(seq 1 30); do
        if out=$(query "${payload}" 2>/dev/null); then
            status=$(echo "${out}" | jq -r .status)
            if [ "${status}" = "${expected}" ]; then
                echo "${out}"
                return 0
            fi
        fi
        sleep 2
    done
    echo "ERROR: batch ${BATCH} did not reach ${expected} (last status: ${status:-none})" >&2
    return 1
}

echo "==================================================================="
echo "E-Waste smoke test  batch=${BATCH}"
echo "==================================================================="

echo
echo ">>> [1/6] collector creates the batch"
use_identity org1 collector 7051 Org1MSP "${ORG1}/peers/peer0.org1.example.com/tls/ca.crt"
invoke "$(jq -nc --arg b "${BATCH}" --arg d "${TODAY}" --arg u "${UUIDS}" \
    '{function:"CreateBatch",Args:[$b,$d,$u,"collector-cp1"]}')" >/dev/null
BODY=$(snapshot AT_COLLECTOR)
echo "${BODY}" | jq '{batchId,date,itemCount,ownerRole,status}'
TOKEN=$(echo "${BODY}" | jq -r .qrToken)

echo
echo ">>> [2/6] transporter scans QR (collector -> transporter)"
use_identity org1 transporter 7051 Org1MSP "${ORG1}/peers/peer0.org1.example.com/tls/ca.crt"
invoke "$(jq -nc --arg b "${BATCH}" --arg t "${TOKEN}" \
    '{function:"TransferBatch",Args:[$b,$t]}')" >/dev/null
BODY=$(snapshot IN_TRANSIT)
echo "${BODY}" | jq '{ownerRole,status}'
TOKEN=$(echo "${BODY}" | jq -r .qrToken)

echo
echo ">>> [3/6] recycler scans QR (transporter -> recycler)"
use_identity org2 recycler 9051 Org2MSP "${ORG2}/peers/peer0.org2.example.com/tls/ca.crt"
invoke "$(jq -nc --arg b "${BATCH}" --arg t "${TOKEN}" \
    '{function:"TransferBatch",Args:[$b,$t]}')" >/dev/null
BODY=$(snapshot AT_RECYCLER)
echo "${BODY}" | jq '{ownerRole,status}'
TOKEN=$(echo "${BODY}" | jq -r .qrToken)

echo
echo ">>> [4/6] manufacturer scans QR (recycler -> manufacturer)"
use_identity org2 manufacturer 9051 Org2MSP "${ORG2}/peers/peer0.org2.example.com/tls/ca.crt"
invoke "$(jq -nc --arg b "${BATCH}" --arg t "${TOKEN}" \
    '{function:"TransferBatch",Args:[$b,$t]}')" >/dev/null
BODY=$(snapshot SOLD_TO_MANUFACTURER)
echo "${BODY}" | jq '{ownerRole,status}'

echo
echo ">>> [5/6] provenance history"
HIST=$(query "$(jq -nc --arg b "${BATCH}" '{function:"GetBatchHistory",Args:[$b]}')")
echo "${HIST}" | jq 'map(.value.history) | add'

echo
echo ">>> [6/6] negative test: manufacturer tries to transfer further (must fail)"
set +e
use_identity org1 collector 7051 Org1MSP "${ORG1}/peers/peer0.org1.example.com/tls/ca.crt"
invoke "$(jq -nc --arg b "${BATCH}" --arg t "irrelevant" \
    '{function:"TransferBatch",Args:[$b,$t]}')" >/tmp/neg.log 2>&1
NEG=$?
set -e
if [ "${NEG}" -ne 0 ]; then
    echo "OK: transfer after manufacturer correctly rejected"
else
    echo "UNEXPECTED: transfer after manufacturer was accepted"
fi

echo
echo "==================================================================="
echo "Smoke test complete."
echo "==================================================================="
