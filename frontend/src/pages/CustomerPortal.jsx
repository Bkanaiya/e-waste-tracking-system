import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';

const EMPTY = {
    category: '',
    brand: '',
    model: '',
    condition: 'Working',
    collectionPoint: '',
    weightKg: ''
};

export default function CustomerPortal() {
    const { user } = useAuth();
    const [categories, setCategories] = useState([]);
    const [items, setItems] = useState([]);
    const [form, setForm] = useState(EMPTY);
    const [message, setMessage] = useState(null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);

    const loadItems = async () => {
        try {
            const rows = await api('/ewaste/mine');
            setItems(rows);
        } catch (e) {
            setError(e.message);
        }
    };

    useEffect(() => {
        (async () => {
            try {
                const cat = await api('/ewaste/categories', { auth: false });
                setCategories(cat.categories);
                setForm((f) => ({ ...f, category: cat.categories[0] || '' }));
                await loadItems();
            } catch (e) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setMessage(null);
        setBusy(true);
        try {
            const item = await api('/ewaste', {
                method: 'POST',
                body: {
                    category: form.category,
                    brand: form.brand || undefined,
                    model: form.model || undefined,
                    condition: form.condition,
                    collectionPoint: form.collectionPoint || undefined,
                    weightKg: form.weightKg === '' ? undefined : Number(form.weightKg)
                }
            });
            setMessage(`Submitted ${item.uuid} (${item.category}). It will be added to the next batch.`);
            setForm({ ...EMPTY, category: form.category });
            await loadItems();
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <div className="card">
                <h2>Customer portal</h2>
                <p className="muted">
                    Signed in as <strong>{user.name}</strong> ({user.email})
                </p>
            </div>

            <div className="grid">
                <div className="card">
                    <h3>Submit e-waste</h3>
                    <form onSubmit={onSubmit}>
                        <label>Category</label>
                        <select value={form.category} onChange={set('category')} required>
                            {categories.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>

                        <div className="row">
                            <div>
                                <label>Brand</label>
                                <input value={form.brand} onChange={set('brand')} placeholder="Samsung" />
                            </div>
                            <div>
                                <label>Model</label>
                                <input value={form.model} onChange={set('model')} placeholder="Galaxy S9" />
                            </div>
                        </div>

                        <div className="row">
                            <div>
                                <label>Condition</label>
                                <select value={form.condition} onChange={set('condition')}>
                                    <option>Working</option>
                                    <option>Broken</option>
                                    <option>Dead</option>
                                </select>
                            </div>
                            <div>
                                <label>Weight (kg)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={form.weightKg}
                                    onChange={set('weightKg')}
                                />
                            </div>
                        </div>

                        <label>Collection point</label>
                        <input
                            value={form.collectionPoint}
                            onChange={set('collectionPoint')}
                            placeholder="e.g. Green Park drop-off"
                        />

                        <button className="btn" type="submit" disabled={busy}>
                            {busy ? 'Submitting…' : 'Submit item'}
                        </button>
                    </form>

                    {message && <div className="alert ok">{message}</div>}
                    {error && <div className="alert error">{error}</div>}
                </div>

                <div className="card">
                    <h3>My submitted items</h3>
                    {loading ? (
                        <p className="muted">Loading…</p>
                    ) : items.length === 0 ? (
                        <p className="muted">No items submitted yet.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>UUID</th>
                                    <th>Category</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((it) => (
                                    <tr key={it.uuid}>
                                        <td>
                                            <code>{it.uuid}</code>
                                        </td>
                                        <td>
                                            {it.category}
                                            {it.brand ? ` · ${it.brand}` : ''}
                                        </td>
                                        <td>
                                            {it.batchId ? (
                                                <Link to={`/trace/${it.batchId}`}>
                                                    <span className="badge">BATCHED</span>
                                                </Link>
                                            ) : (
                                                <span className="badge">SUBMITTED</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </Layout>
    );
}
