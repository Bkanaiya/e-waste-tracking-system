import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { useAuth } from '../lib/auth.jsx';
import { ROLES, STAFF_ROLES, roleLabel } from '../lib/roles.js';

const DEMO_HINT = {
    collector: 'collectorpw',
    transporter: 'transporterpw',
    recycler: 'recyclerpw',
    manufacturer: 'manufacturerpw'
};

function portalPath(role) {
    if (role === ROLES.CUSTOMER) return '/customer';
    if (role === ROLES.COLLECTOR) return '/staff/collector';
    return `/staff/${role}`;
}

export default function Login() {
    const { role } = useParams();
    const navigate = useNavigate();
    const { user, loginCustomer, loginStaff } = useAuth();

    const isCustomer = role === ROLES.CUSTOMER;
    const isStaff = STAFF_ROLES.includes(role);

    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ name: '', email: '', phone: '', address: '', password: '' });
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    if (!isCustomer && !isStaff) {
        return (
            <Layout>
                <div className="card">
                    <h2>Unknown portal</h2>
                    <p className="muted">There is no portal called “{role}”.</p>
                    <Link className="btn" to="/">
                        Back home
                    </Link>
                </div>
            </Layout>
        );
    }

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (isCustomer) {
                const payload = {
                    name: form.name,
                    email: form.email,
                    phone: form.phone || undefined,
                    address: form.address || undefined
                };
                await loginCustomer(mode, payload);
            } else {
                await loginStaff(role, form.password);
            }
            navigate(portalPath(role), { replace: true });
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Layout>
            <div className="card" style={{ maxWidth: 460, margin: '0 auto' }}>
                <h2>{roleLabel(role)} sign in</h2>

                {user && user.role !== role && (
                    <div className="alert info">
                        You are currently signed in as <strong>{roleLabel(user.role)}</strong>.
                        Signing in here will switch portals.
                    </div>
                )}

                {isCustomer && (
                    <div className="row" style={{ marginBottom: 8 }}>
                        <button
                            type="button"
                            className={mode === 'login' ? 'btn' : 'btn ghost'}
                            onClick={() => setMode('login')}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            className={mode === 'register' ? 'btn' : 'btn ghost'}
                            onClick={() => setMode('register')}
                        >
                            Register
                        </button>
                    </div>
                )}

                <form onSubmit={onSubmit}>
                    {isCustomer && mode === 'register' && (
                        <>
                            <label>Full name</label>
                            <input value={form.name} onChange={set('name')} required />
                        </>
                    )}

                    {isCustomer ? (
                        <>
                            <label>Email</label>
                            <input
                                type="email"
                                value={form.email}
                                onChange={set('email')}
                                placeholder="you@example.com"
                                required
                            />
                            {mode === 'register' && (
                                <>
                                    <label>Phone (optional)</label>
                                    <input value={form.phone} onChange={set('phone')} />
                                    <label>Address (optional)</label>
                                    <input value={form.address} onChange={set('address')} />
                                </>
                            )}
                        </>
                    ) : (
                        <>
                            <label>{roleLabel(role)} password</label>
                            <input
                                type="password"
                                value={form.password}
                                onChange={set('password')}
                                placeholder={`demo: ${DEMO_HINT[role]}`}
                                required
                            />
                            <p className="muted small">
                                Demo password: <code>{DEMO_HINT[role]}</code>
                            </p>
                        </>
                    )}

                    {error && <div className="alert error">{error}</div>}

                    <button className="btn" type="submit" disabled={busy}>
                        {busy ? 'Signing in…' : mode === 'register' ? 'Create account' : 'Sign in'}
                    </button>
                </form>

                {isCustomer && mode === 'login' && (
                    <p className="muted small" style={{ marginTop: 12 }}>
                        New here?{' '}
                        <a
                            href="#"
                            onClick={(e) => {
                                e.preventDefault();
                                setMode('register');
                            }}
                        >
                            Create an account
                        </a>
                    </p>
                )}

                {user && user.role !== role && (
                    <p className="muted small" style={{ marginTop: 12 }}>
                        Currently signed in as {roleLabel(user.role)} —{' '}
                        <Link to={portalPath(user.role)}>go to my portal</Link>.
                    </p>
                )}
            </div>
        </Layout>
    );
}
