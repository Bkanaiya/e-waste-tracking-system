import { Link } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { ROLES, roleLabel } from '../lib/roles.js';

const TILES = [
    { role: ROLES.CUSTOMER, icon: '🏠', desc: 'Submit e-waste and track your items' },
    { role: ROLES.COLLECTOR, icon: '🧺', icon2: '', desc: 'Finalize the daily batch and mint QR codes' },
    { role: ROLES.TRANSPORTER, label: 'Transporter', icon: '🚚', desc: 'Scan and move batches to the recycler' },
    { role: ROLES.RECYCLER, icon: '🏭', desc: 'Receive and process batches' },
    { role: ROLES.MANUFACTURER, icon: '🏭', desc: 'Accept recycled material for reuse' }
];

export default function Home() {
    return (
        <Layout>
            <section className="hero">
                <h1>E-Waste Tracking on Hyperledger Fabric</h1>
                <p>
                    Customers hand over electronic waste, a collector batches it daily, and each
                    custody hand-off (collector → transporter → recycler → manufacturer) is recorded
                    immutably on-chain and verifiable by anyone.
                </p>
                <Link className="btn secondary" to="/trace">
                    Verify a batch provenance
                </Link>
            </section>

            <div className="card">
                <h3>Choose a portal</h3>
                <p className="muted small">
                    Each portal signs in as a different Fabric identity, so the on-chain rules
                    (who may transfer to whom) are enforced by the network itself.
                </p>
                <div className="portal-grid">
                    {TILES.map((t) => (
                        <Link key={t.role} className="portal-tile" to={`/login/${t.role}`}>
                            <span className="icon">{t.icon}</span>
                            {roleLabel(t.role)}
                        </Link>
                    ))}
                </div>
            </div>
        </Layout>
    );
}
