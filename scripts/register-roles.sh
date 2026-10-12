#!/usr/bin/env bash
#
# Registers and enrolls the four E-Waste participant identities against the
# test-network Fabric CAs. Each identity carries an ECert attribute:
#     role=<collector|transporter|recycler|manufacturer>
#     uid=<identity name>
# The chaincode reads these attributes for ABAC.
#
# Organisation layout:
#   Org1 -> collector, transporter
#   Org2 -> recycler, manufacturer
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="${SCRIPT_DIR}/../../fabric-samples/test-network"
BIN_DIR="${SCRIPT_DIR}/../../fabric-samples/bin"
export PATH="${BIN_DIR}:${PATH}"

ORGS_BASE="${NETWORK_DIR}/organizations"
FABRIC_CA_DIR="${ORGS_BASE}/fabric-ca"

register_enroll() {
    local org="$1"          # org1 | org2
    local caname="$2"       # ca-org1 | ca-org2
    local caport="$3"       # 7054 | 8054
    local id="$4"           # identity login name
    local secret="$5"       # identity password
    local role="$6"         # chaincode role attribute

    local ca_cert="${FABRIC_CA_DIR}/${org}/ca-cert.pem"
    local org_domain="${org}.example.com"
    # The bootstrap CA admin (registrar) is enrolled into the org-level msp dir
    # by fabric-samples/test-network/organizations/fabric-ca/registerEnroll.sh.
    local admin_home="${ORGS_BASE}/peerOrganizations/${org_domain}"
    local user_home="${ORGS_BASE}/peerOrganizations/${org_domain}/users/${id}@${org_domain}"

    echo ">>> Registering ${id} (role=${role}) on ${caname}"
    export FABRIC_CA_CLIENT_HOME="${admin_home}"
    fabric-ca-client register \
        --caname "${caname}" \
        --id.name "${id}" \
        --id.secret "${secret}" \
        --id.attrs "role=${role}:ecert,uid=${id}:ecert" \
        -u "https://localhost:${caport}" \
        --tls.certfiles "${ca_cert}" \
        >/dev/null

    echo ">>> Enrolling ${id} -> ${user_home}/msp"
    mkdir -p "${user_home}"
    fabric-ca-client enroll \
        -u "https://${id}:${secret}@localhost:${caport}" \
        --caname "${caname}" \
        -M "${user_home}/msp" \
        --tls.certfiles "${ca_cert}" \
        >/dev/null

    # Enable NodeOUs so the identity can be used by CLI/gateway tooling.
    cp "${admin_home}/msp/config.yaml" "${user_home}/msp/config.yaml"

    echo "    done: ${id}"
}

register_enroll org1 ca-org1 7054 collector    collectorpw    collector
register_enroll org1 ca-org1 7054 transporter  transporterpw  transporter
register_enroll org2 ca-org2 8054 recycler     recyclerpw     recycler
register_enroll org2 ca-org2 8054 manufacturer manufacturerpw manufacturer

echo "All role identities registered and enrolled."
