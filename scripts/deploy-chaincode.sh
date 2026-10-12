#!/usr/bin/env bash
#
# Deploy (package + install + approve + commit) the ewaste chaincode.
#
# This is a more resilient alternative to `network.sh deployCC` for machines
# with limited resources, where long chaincode builds and flaky gRPC
# connections cause "too_many_pings" / "context deadline exceeded" errors:
#   * a generous --connTimeout on every peer command
#   * install is skipped when the package is already present
#   * approve/commit are retried a few times
#
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NET="${ROOT_DIR}/../fabric-samples/test-network"
export PATH="${ROOT_DIR}/../fabric-samples/bin:${PATH}"
export FABRIC_CFG_PATH="${ROOT_DIR}/../fabric-samples/config"

CC_NAME=ewaste
CC_VERSION=1.0
CC_SEQUENCE=1
CC_PATH="${ROOT_DIR}/chaincode/ewaste-js"
CHANNEL=mychannel
ORDERER=localhost:7050
ORDERER_HOST=orderer.example.com
ORDERER_CA="${NET}/organizations/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"
ORG1_TLS="${NET}/organizations/peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt"
ORG2_TLS="${NET}/organizations/peerOrganizations/org2.example.com/peers/peer0.org2.example.com/tls/ca.crt"

use_org1() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org1MSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$ORG1_TLS"
    export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:7051
}

use_org2() {
    export CORE_PEER_TLS_ENABLED=true
    export CORE_PEER_LOCALMSPID=Org2MSP
    export CORE_PEER_TLS_ROOTCERT_FILE="$ORG2_TLS"
    export CORE_PEER_MSPCONFIGPATH="${NET}/organizations/peerOrganizations/org2.example.com/users/Admin@org2.example.com/msp"
    export CORE_PEER_ADDRESS=localhost:9051
}

retry() {
    local attempt=1
    while [ "$attempt" -le 4 ]; do
        if "$@"; then return 0; fi
        echo "  ...attempt ${attempt} failed, retrying in 6s" >&2
        sleep 6
        attempt=$((attempt + 1))
    done
    echo "ERROR: command failed after retries: $*" >&2
    return 1
}

cd "$NET"

echo ">>> [1/5] Packaging ${CC_NAME} v${CC_VERSION}"
peer lifecycle chaincode package "${CC_NAME}.tar.gz" \
    --path "$CC_PATH" --lang node --label "${CC_NAME}_${CC_VERSION}"

echo ">>> [2/5] Installing on peer0.org1 (skipped if present)"
use_org1
PKG1=$(peer lifecycle chaincode queryinstalled --output json --connTimeout 60s 2>/dev/null \
    | jq -r --arg l "${CC_NAME}_${CC_VERSION}" '.installed_chaincodes[]? | select(.label==$l) | .package_id' | head -1)
if [ -z "$PKG1" ]; then
    retry peer lifecycle chaincode install "${CC_NAME}.tar.gz" --connTimeout 600s
    PKG1=$(peer lifecycle chaincode queryinstalled --output json --connTimeout 60s \
        | jq -r --arg l "${CC_NAME}_${CC_VERSION}" '.installed_chaincodes[] | select(.label==$l) | .package_id' | head -1)
fi
echo "    org1 package-id: ${PKG1}"

echo ">>> [3/5] Installing on peer0.org2 (skipped if present)"
use_org2
PKG2=$(peer lifecycle chaincode queryinstalled --output json --connTimeout 60s \
    | jq -r ".installed_chaincodes[]? | select(.package_id == \"${PKG1}\") | .package_id" | head -1)
if [ -z "$PKG2" ]; then
    retry peer lifecycle chaincode install "${CC_NAME}.tar.gz" --connTimeout 1200s
    PKG2=$(peer lifecycle chaincode queryinstalled --output json --connTimeout 60s \
        | jq -r --arg l "${CC_NAME}_${CC_VERSION}" '.installed_chaincodes[]?.package_id' | head -1)
fi
echo "    org2 package: ${PKG2}"

echo ">>> [3b] Approving for Org1"
use_org1
retry peer lifecycle chaincode approveformyorg \
    -o "$ORDERER" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_CA" \
    --channelID "$CHANNEL" --name "$CC_NAME" --version "$CC_VERSION" \
    --package-id "$PKG1" --sequence "$CC_SEQUENCE" \
    --connTimeout 60s --waitForEventTimeout 180s

echo ">>> [4/5] Approving for Org2"
use_org2
retry peer lifecycle chaincode approveformyorg \
    -o "$ORDERER" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_CA" \
    --channelID "$CHANNEL" --name "$CC_NAME" --version "$CC_VERSION" \
    --package-id "$PKG2" --sequence "$CC_SEQUENCE" \
    --connTimeout 60s --waitForEventTimeout 180s

echo ">>> [4b] Commit readiness"
use_org1
peer lifecycle chaincode checkcommitreadiness \
    --channelID "$CHANNEL" --name "$CC_NAME" --version "$CC_VERSION" \
    --sequence "$CC_SEQUENCE" --output json || true

echo ">>> [5/5] Committing"
retry peer lifecycle chaincode commit \
    -o "$ORDERER" --ordererTLSHostnameOverride "$ORDERER_HOST" \
    --tls --cafile "$ORDERER_CA" \
    --channelID "$CHANNEL" --name "$CC_NAME" --version "$CC_VERSION" \
    --sequence "$CC_SEQUENCE" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$ORG1_TLS" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$ORG2_TLS" \
    --connTimeout 60s --waitForEventTimeout 180s

echo ">>> Committed chaincode definitions:"
peer lifecycle chaincode querycommitted --channelID "$CHANNEL" --name "$CC_NAME" \
    --connTimeout 60s
