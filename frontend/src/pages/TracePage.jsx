import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import BatchStatus from '../components/BatchStatus.jsx';
import { api } from '../lib/api.js';
import { roleLabel, statusLabel } from '../lib/roles.js';

export default function TracePage() {
    const { batchId } = useParams();
    const navigate = useNavigate();

    const [input, setInput] = useState(batchId || '');
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(Boolean(batchId));

    useEffect(() => {
        if (!batchId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        (async () => {
            try {
                const res = await api(`/trace/${batchId}`, { auth: false });
                if (!cancelled) setData(res);
            } catch (e) {
                if (!cancelled) {
                    setData(null);
                    setError(e.message);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [batchId]);

    const onSubmit = (e) => {
        e.preventDefault();
        const value = input.trim();
        if (value) navigate(`/trace/${value}`);
    };

    return (
        <Layout>
            <div className="card">
                <h2>Public batch trace</h2>
                <p className="muted">
                    Anyone can verify where a batch of e-waste came from and every custody hand-off
                    it went through. No sign-in required.
                </p>
                <form className="row" onSubmit={onSubmit}>
                    <div style={{ flex: 3 }}>
                        <label>Batch ID</label>
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="BATCH-DD-MM-YYYY-NN"
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <button className="btn" type="submit">
                            Trace
                        </button>
                    </div>
                </form>
            </div>

            {loading && <div className="card">Loading…</div>}
            {error && <div className="alert error">{error}</div>}

            {data && (
                <>
                    <div className="card">
                        <h3>Batch {data.batch.batchId}</h3>
                        <p className="muted small">
                            Collected {data.batch.date} · {data.batch.itemCount} item(s) · created{' '}
                            {new Date(data.batch.createdAt).toLocaleString()}
                        </p>
                        <BatchStatus status={data.batch.status} />
                    </div>

                    <div className="grid">
                        <div className="card">
                            <h3>Provenance</h3>
                            <ul className="timeline">
                                {data.provenance.map((h, i) => (
                                    <li key={i}>
                                        <strong>{h.action}</strong>{' '}
                                        <span className="muted">
                                            {h.role ? `by ${roleLabel(h.role)}` : ''}
                                            {h.from ? ` (from ${roleLabel(h.from)})` : ''}
                                        </span>
                                        <br />
                                        <span className="small">
                                            status: {statusLabel(h.status)}
                                        </span>
                                        <br />
                                        <span className="muted small">
                                            {new Date(h.at).toLocaleString()}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="card">
                            <h3>Items in this batch</h3>
                            {data.items.length === 0 ? (
                                <p className="muted small">No off-chain item details available.</p>
                            ) : (
                                <table>
                                    <thead>
                                        <tr>
                                            <th>UUID</th>
                                            <th>Category</th>
                                            <th>Brand / model</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.items.map((it) => (
                                            <tr key={it.uuid}>
                                                <td>
                                                    <code>{it.uuid}</code>
                                                </td>
                                                <td>{it.category}</td>
                                                <td>
                                                    {it.brand || '—'}
                                                    {it.model ? ` / ${it.model}` : ''}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}
        </Layout>
    );
}
