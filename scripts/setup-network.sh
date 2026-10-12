#!/usr/bin/env bash
#
# One-shot bootstrap for the E-Waste Fabric network:
#   1. (re)start the test-network with CAs and the mychannel channel
#   2. register + enroll the four role identities (with ECert role attributes)
#   3. deploy the ewaste chaincode
#
# Safe to re-run; it tears the network down first.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
NETWORK_DIR="${ROOT_DIR}/../fabric-samples/test-network"
export PATH="${ROOT_DIR}/../fabric-samples/bin:${PATH}"

echo ">>> [1/3] Bringing up the test-network"
cd "${NETWORK_DIR}"
./network.sh down >/dev/null 2>&1 || true
./network.sh up createChannel -ca

echo ">>> [2/3] Registering role identities"
"${SCRIPT_DIR}/register-roles.sh"

echo ">>> [3/3] Deploying the ewaste chaincode"
./network.sh deployCC \
    -ccn ewaste \
    -ccp "${ROOT_DIR}/chaincode/ewaste-js" \
    -ccl javascript

echo "Network ready. Run '${SCRIPT_DIR}/smoke-test.sh' to verify."
