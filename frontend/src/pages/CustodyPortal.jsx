import { useEffect, useState } from 'react';
import { useParams, Navigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import BatchStatus from '../components/BatchStatus.jsx';
import QrScanner from '../components/QrScanner.jsx';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { ROLES, roleLabel, statusLabel } from '../lib/roles.js';

const VALID_ROLES = [ROLES.TRANSPORTER, ROLES.RECYCLER, ROLES.MANUFACTURER];

export default function CustodyPortal() {
    const { role } = useParams();
    const location = useLocation();
    const { user } = useAuth();

    const [batches, setBatches] = useState([]);
    const [result, setResult] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    const active = VALID_ROLES.includes(role) && user && user.role === role;

    useEffect(() => {
        if (!active) return;
        let cancelled = false;
        (async () => {
            try {
                const rows = await api('/batches');
                if (!cancelled) setBatches(rows);
            } catch (e) {
                if (!cancelled) setError(e.message);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [active, role]);

    if (!VALID_ROLES.includes(role)) {
        return <Navigate to={`/staff/${ROLES.TRANSPORTER}`} replace />;
    }
    if (!user) {
        return <Navigate to={`/login/${role}`} state={{ from: location }} replace />;
    }
    if (user.role !== role) {
        return (
            <Layout>
                <div className="card">
                    <h2>Wrong portal</h2>
                    <p className="muted">
                        You are signed in as {roleLabel(user.role)}. Open the {roleLabel(role)}{' '}
                        portal instead.
                    </p>
                </div>
            </Layout>
        );
    }

    const onScan = async (payload) => {
        setError(null);
        setResult(null);
        setBusy(true);
        try {
            const data = await api('/transfers/scan', {
                method: 'POST',
                body: { qr: payload }
            });
            setResult(data);
            setBatches(await api('/batches'));
        } catch (e) {
            setError(e.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <div className="card">
                <h2>{roleLabel(role)} portal</h2>
                <p className="muted">
                    Scan the custodian’s batch QR code to take ownership. The transfer is validated
                    against the current owner on-chain.
                </p>
            </div>

            {error && <div className="alert error">{error}</div>}

            {result && (
                <div className="card">
                    <div className="alert ok">
                        Custody accepted: batch <strong>{result.batchId}</strong> is now{' '}
                        {statusLabel(result.status)} (owner: {roleLabel(result.ownerRole)}).
                    </div>
                    <BatchStatus status={result.status} />
                    {result.qr && (
                        <div style={{ marginTop: 12 }}>
                            <p className="muted small">
                                {result.ownerRole === ROLES.MANUFACTURER
                                    ? 'Final custody reached — this batch is fully traced.'
                                    : 'Present this new QR code to the next custodian:'}
                            </p>
                            <div className="qr-frame">
                                <img src={result.qr.dataUrl} alt="next custody QR" />
                            </div>
                            <pre className="muted small">{result.qr.payload}</pre>
                        </div>
                    )}
                </div>
            )}

            <div className="grid">
                <div className="card">
                    <h3>Scan a batch QR</h3>
                    <QrScanner onResult={onScan} disabled={busy} />
                </div>

                <div className="card">
                    <h3>Batches I own</h3>
                    {batches.length === 0 ? (
                        <p className="muted">You currently hold no batches.</p>
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
                                    <tr key={b.batchId}>
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
                    <p className="muted small" style={{ marginTop: 12 }}>
                        Tip: on a desktop without a camera, paste the QR payload text from the
                        previous custodian.
                    </p>
                </div>
            </div>
        </Layout>
    );
}
