import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

const ELEMENT_ID = 'qr-reader';

export default function QrScanner({ onResult, disabled }) {
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState(null);
    const [manual, setManual] = useState('');
    const scannerRef = useRef(null);

    const stop = async () => {
        const scanner = scannerRef.current;
        scannerRef.current = null;
        setScanning(false);
        if (!scanner) return;
        try {
            await scanner.stop();
            await scanner.clear();
        } catch {
            /* already stopped */
        }
    };

    const start = async () => {
        setError(null);
        if (scannerRef.current) return;
        const scanner = new Html5Qrcode(ELEMENT_ID, { verbose: false });
        scannerRef.current = scanner;
        try {
            await scanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 240, height: 240 } },
                (decodedText) => {
                    stop();
                    onResult(decodedText);
                },
                () => {
                    /* per-frame decode misses are ignored */
                }
            );
            setScanning(true);
        } catch (e) {
            scannerRef.current = null;
            setError(
                'Camera unavailable or permission denied. Use the manual entry below.'
            );
            void e;
        }
    };

    useEffect(() => {
        return () => {
            void stop();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const submitManual = (e) => {
        e.preventDefault();
        const value = manual.trim();
        if (!value) return;
        setManual('');
        onResult(value);
    };

    return (
        <div>
            <div id={ELEMENT_ID} />

            {!scanning ? (
                <button className="btn secondary" onClick={start} disabled={disabled}>
                    Start camera
                </button>
            ) : (
                <button className="btn ghost" onClick={stop}>
                    Stop camera
                </button>
            )}

            {error && <div className="alert error">{error}</div>}

            <form onSubmit={submitManual} style={{ marginTop: 16 }}>
                <label>Or paste a scanned QR payload</label>
                <textarea
                    rows={3}
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder='{"type":"EWASTE_BATCH","batchId":"BATCH-...","token":"..."}'
                />
                <button className="btn" type="submit" disabled={disabled}>
                    Submit payload
                </button>
            </form>
        </div>
    );
}
