import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import Login from './pages/Login.jsx';
import CustomerPortal from './pages/CustomerPortal.jsx';
import CollectorPortal from './pages/CollectorPortal.jsx';
import CustodyPortal from './pages/CustodyPortal.jsx';
import TracePage from './pages/TracePage.jsx';
import { ROLES, roleLabel } from './lib/roles.js';

function RequireRole({ role, children }) {
    const { user } = useAuth();
    const location = useLocation();

    if (!user) {
        return <Navigate to={`/login/${role}`} state={{ from: location }} replace />;
    }
    if (user.role !== role) {
        return (
            <Layout>
                <div className="card">
                    <h2>Wrong portal</h2>
                    <p className="muted">
                        You are signed in as <strong>{roleLabel(user.role)}</strong>. Please open the{' '}
                        {roleLabel(role)} portal instead.
                    </p>
                </div>
            </Layout>
        );
    }
    return children;
}

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login/:role" element={<Login />} />
            <Route path="/trace" element={<TracePage />} />
            <Route path="/trace/:batchId" element={<TracePage />} />

            <Route
                path="/customer"
                element={
                    <RequireRole role={ROLES.CUSTOMER}>
                        <CustomerPortal />
                    </RequireRole>
                }
            />
            <Route
                path="/staff/collector"
                element={
                    <RequireRole role={ROLES.COLLECTOR}>
                        <CollectorPortal />
                    </RequireRole>
                }
            />
            <Route
                path="/staff/:role"
                element={<CustodyPortal />}
            />

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
