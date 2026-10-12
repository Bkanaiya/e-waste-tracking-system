import { statusLabel } from '../lib/roles.js';

const STEPS = [
    { key: 'AT_COLLECTOR', label: 'Collector' },
    { key: 'IN_TRANSIT', label: 'Transporter' },
    { key: 'AT_RECYCLER', label: 'Recycler' },
    { key: 'SOLD_TO_MANUFACTURER', label: 'Manufacturer' }
];

export default function BatchStatus({ status }) {
    const index = STEPS.findIndex((s) => s.key === status);
    return (
        <div>
            <div className="steps">
                {STEPS.map((s, i) => (
                    <div
                        key={s.key}
                        className={
                            'step' + (i < index ? ' done' : '') + (i === index ? ' current' : '')
                        }
                    >
                        {s.label}
                    </div>
                ))}
            </div>
            <p className="muted small">
                Current status: <span className={`badge ${status}`}>{statusLabel(status)}</span>
            </p>
        </div>
    );
}
