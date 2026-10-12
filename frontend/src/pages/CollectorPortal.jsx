import { useEffect, useState } from 'react';
import Layout from '../components/Layout.jsx';
import BatchStatus from '../components/BatchStatus.jsx';
import { api } from '../lib/api.js';
import { statusLabel } from '../lib/roles.js';

export default function CollectorPortal() {
    const [batches, setBatches] = useState([]);
    const [selected, setSelected] = useState(null);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const loadBatches = async () => {
        try {
            setBatches(await api('/batches'));
        } catch (e) {
            setError(e.message);
        }
    };

    useEffect(() => {
        loadBatches();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const finalize = async () => {
        setError(null);
        setMessage(null);
        setBusy(true);
        try {
            const batch = await api('/batches/finalize', { method: 'POST' });
            setMessage(`Batch ${batch.batchId} sealed with ${batch.itemCount} item(s).`);
            setSelected(batch);
            await loadBatches();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    const openBatch = async (batchId) => {
        setError(null);
        try {
            setSelected(await api(`/batches/${batchId}`));
        } catch (e) {
            setError(e.message);
        }
    };

    return (
        <Layout>
            <div className="card">
                <h2>Collector portal</h2>
                <p className="muted">
                    Seal today’s submitted e-waste into a batch and write it to the ledger. The
                    generated QR code carries custody to the transporter.
                </p>
                <button className="btn" onClick={finalize} disabled={busy}>
                    {busy ? 'Sealing batch…' : "Finalize today's batch"}
                </button>
            </div>

            {message && <div className="alert ok">{message}</div>}
            {error && <div className="alert error">{error}</div>}

            <div className="grid">
                <div className="card">
                    <h3>Batches I own</h3>
                    {batches.length === 0 ? (
                        <p className="muted">No batches yet.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Batch</th>
                                    <th>Items</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {batches.map((b) => (
                                    <tr
                                        key={b.batchId}
                                        className="clickable"
                                        onClick={() => openBatch(b.batchId)}
                                    >
                                        <td>
                                            <code>{b.batchId}</code>
                                        </td>
                                        <td>{b.itemCount}</td>
                                        <td>
                                            <span className={`badge ${b.status}`}>
                                                {statusLabel(b.status)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="card">
                    <h3>Batch detail</h3>
                    {!selected ? (
                        <p className="muted">Select a batch to view its QR code and contents.</p>
                    ) : (
                        <>
                            <p>
                                <strong>{selected.batchId}</strong>
                                <br />
                                <span className="muted small">{selected.date}</span>
                            </p>
                            <BatchStatus status={selected.status} />

                            {selected.qr ? (
                                <div style={{ marginTop: 12 }}>
                                    <p className="muted small">
                                        Show this QR to the transporter to hand over custody:
                                    </p>
                                    <div className="qr-frame">
                                        <img src={selected.qr.dataUrl} alt="batch QR" />
                                    </div>
                                    <pre className="muted small">{selected.qr.payload}</pre>
                                </div>
                            ) : (
                                <p className="muted small">
                                    You are not the current custodian of this batch.
                                </p>
                            )}

                            {selected.items && selected.items.length > 0 && (
                                <>
                                    <h3 style={{ marginTop: 20 }}>Items</h3>
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>UUID</th>
                                                <th>Category</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selected.items.map((it) => (
                                                <tr key={it.uuid}>
                                                    <td>
                                                        <code>{it.uuid}</code>
                                                    </td>
                                                    <td>
                                                        {it.category}
                                                        {it.brand ? ` · ${it.brand}` : ''}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </Layout>
    );
}
