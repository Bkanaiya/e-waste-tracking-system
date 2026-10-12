export const ROLES = {
    CUSTOMER: 'customer',
    COLLECTOR: 'collector',
    TRANSPORTER: 'transporter',
    RECYCLER: 'recycler',
    MANUFACTURER: 'manufacturer'
};

export const STAFF_ROLES = [
    ROLES.COLLECTOR,
    ROLES.TRANSPORTER,
    ROLES.RECYCLER,
    ROLES.MANUFACTURER
];

const LABELS = {
    customer: 'Customer',
    collector: 'Collector',
    transporter: 'Transporter',
    recycler: 'Recycler',
    manufacturer: 'Manufacturer'
};

export function roleLabel(role) {
    return LABELS[role] || role;
}

export const STATUS_LABELS = {
    AT_COLLECTOR: 'At collector',
    IN_TRANSIT: 'In transit',
    AT_RECYCLER: 'At recycler',
    SOLD_TO_MANUFACTURER: 'Sold to manufacturer'
};

export function statusLabel(status) {
    return STATUS_LABELS[status] || status;
}

export const NEXT_OWNER = {
    collector: 'transporter',
    transporter: 'recycler',
    recycler: 'manufacturer'
};

export function nextOwner(status) {
    const map = {
        AT_COLLECTOR: 'transporter',
        IN_TRANSIT: 'recycler',
        AT_RECYCLER: 'manufacturer'
    };
    return map[status] || null;
}
