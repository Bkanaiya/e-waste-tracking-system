import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import { ROLES, roleLabel } from '../lib/roles.js';

const NAV = [
    { to: '/', label: 'Home' },
    { to: `/login/${ROLES.CUSTOMER}`, label: 'Customer' },
    { to: `/login/${ROLES.COLLECTOR}`, label: 'Collector' },
    { to: `/login/${ROLES.TRANSPORTER}`, label: 'Transporter' },
    { to: `/login/${ROLES.RECYCLER}`, label: 'Recycler' },
    { to: `/login/${ROLES.MANUFACTURER}`, label: 'Manufacturer' },
    { to: '/trace', label: 'Trace' }
];

export default function Layout({ children }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const portalFor = (role) => {
        if (role === ROLES.CUSTOMER) return '/customer';
        if (role === ROLES.COLLECTOR) return '/staff/collector';
        return `/staff/${role}`;
    };

    const onLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <div className="app">
            <header className="topbar">
                <Link to="/" className="brand">
                    <span className="brand-mark">♻</span> E-Waste Trace
                </Link>
                <nav className="nav">
                    {NAV.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={location.pathname === item.to ? 'active' : ''}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                <div className="userbox">
                    {user ? (
                        <>
                            <Link to={portalFor(user.role)} className="chip" title="Go to my portal">
                                {roleLabel(user.role)}
                                {user.email ? ` · ${user.email}` : ''}
                            </Link>
                            <button className="btn ghost" onClick={onLogout}>
                                Sign out
                            </button>
                        </>
                    ) : (
                        <span className="muted small">Not signed in</span>
                    )}
                </div>
            </header>
            <main className="content">{children}</main>
            <footer className="footer">
                <span>Hyperledger Fabric · channel <code>mychannel</code> · chaincode <code>ewaste</code></span>
            </footer>
        </div>
    );
}
