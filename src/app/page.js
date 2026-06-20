'use client';
import { useState, useEffect } from 'react';

export default function Home() {
    const [users, setUsers] = useState({});
    const [matches, setMatches] = useState([]);
    const [predictions, setPredictions] = useState({});
    const [results, setResults] = useState({});
    const [currentUser, setCurrentUser] = useState(null);
    const [selectedUserForLogin, setSelectedUserForLogin] = useState(null);
    const [pinInput, setPinInput] = useState('');
    const [view, setView] = useState('dashboard');
    const [loading, setLoading] = useState(true);
    const [newUser, setNewUser] = useState('');
    const [adminFeedback, setAdminFeedback] = useState({});

    useEffect(() => {
        fetch('/api/data')
            .then(res => res.json())
            .then(data => {
                setUsers(data.users);
                setMatches(data.matches);
                setPredictions(data.predictions);
                setResults(data.results);
                setLoading(false);
            });
        const savedUser = localStorage.getItem('wc_user');
        if (savedUser) setCurrentUser(savedUser);
    }, []);

    const login = (user) => {
        if (users[user] === pinInput) {
            setCurrentUser(user);
            localStorage.setItem('wc_user', user);
            setSelectedUserForLogin(null);
            setPinInput('');
        } else {
            alert('Incorrect PIN!');
        }
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('wc_user');
    };

    const savePrediction = async (matchId) => {
        const t1 = parseInt(document.getElementById(`pred-t1-${matchId}`).value);
        const t2 = parseInt(document.getElementById(`pred-t2-${matchId}`).value);
        if (isNaN(t1) || isNaN(t2)) return alert('Enter valid scores');

        setPredictions(prev => ({ ...prev, [`${matchId}-${currentUser}`]: { t1, t2 } }));

        const response = await fetch('/api/data', {
            method: 'POST',
            // body: JSON.stringify({ type: 'PREDICTION', key: `${matchId}-${currentUser}`, t1, t2 })
            body: JSON.stringify({ type: 'PREDICTION', key: `${matchId}-${currentUser}`, t1, t2, user: currentUser })
        }).then(r => r.json());

        if (response.error) {
            alert("⚠️ " + response.error);
            silentRefresh(); // Reset the UI to truth
        }
    };

    const saveResult = async (matchId) => {
        const t1 = parseInt(document.getElementById(`res-t1-${matchId}`).value);
        const t2 = parseInt(document.getElementById(`res-t2-${matchId}`).value);
        if (isNaN(t1) || isNaN(t2)) return alert('Enter valid scores');

        setResults(prev => ({ ...prev, [matchId]: { t1, t2 } }));
        setAdminFeedback(prev => ({ ...prev, [matchId]: true }));
        setTimeout(() => setAdminFeedback(prev => ({ ...prev, [matchId]: false })), 2000);

        await fetch('/api/data', {
            method: 'POST',
            body: JSON.stringify({ type: 'RESULT', matchId, t1, t2 })
        });
    };

    const addUser = async () => {
        if (!newUser.trim()) return;
        await fetch('/api/data', {
            method: 'POST',
            body: JSON.stringify({ type: 'ADD_USER', user: newUser.trim() })
        });
        setNewUser('');
        const res = await fetch('/api/data').then(r => r.json());
        setUsers(res.users);
    };

    const togglePreds = (matchId, prefix) => {
        const el = document.getElementById(`preds-view-${prefix}-${matchId}`);
        if(el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
    };

    const silentRefresh = async () => {
        const res = await fetch('/api/data').then(r => r.json());
        setUsers(res.users);
        setMatches(res.matches);
        setPredictions(res.predictions);
        setResults(res.results);
    };

    const calculatePoints = (pred, res) => {
        if (!pred || !res) return 0;
        const pT1 = pred.t1, pT2 = pred.t2, rT1 = res.t1, rT2 = res.t2;
        if (pT1 === rT1 && pT2 === rT2) return 5;
        const pDiff = pT1 - pT2, rDiff = rT1 - rT2;
        const pWinner = pDiff > 0 ? 1 : pDiff < 0 ? 2 : 0;
        const rWinner = rDiff > 0 ? 1 : rDiff < 0 ? 2 : 0;
        if (pWinner === rWinner) return pDiff === rDiff ? 3 : 2;
        return 0;
    };

    const formatDate = (dateString) => {
        const d = new Date(dateString);
        return d.toLocaleString([], { timeZone: 'Africa/Nairobi', weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' (EAT)';
    };

    if (loading) return <div style={{padding: '2rem', textAlign: 'center'}}>Loading App...</div>;

    if (!currentUser) {
        if (selectedUserForLogin) {
            return (
                <main style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '4rem', gap: '1rem'}}>
                    <h2>Login as {selectedUserForLogin}</h2>
                    <input type="password" placeholder="4-Digit PIN" value={pinInput} onChange={e => setPinInput(e.target.value)} style={{padding: '0.5rem', fontSize: '1.25rem', textAlign: 'center', width: '150px'}} />
                    <button onClick={() => login(selectedUserForLogin)}>Login</button>
                    <button className="outline" onClick={() => {setSelectedUserForLogin(null); setPinInput('');}}>Cancel</button>
                </main>
            );
        }

        return (
            <main>
                <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', marginTop: '4rem'}}>
                    <h2 style={{fontSize: '1.25rem', color: 'var(--primary)'}}>Select Your Profile</h2>
                    <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', width: '100%'}}>
                        {Object.keys(users).map(u => (
                            <div key={u} onClick={() => setSelectedUserForLogin(u)} className="card" style={{textAlign: 'center', cursor: 'pointer', fontWeight: 600, margin: 0}}>
                                {u}
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        );
    }

    return (
        <>
            <header>
                <h1>🏆 WC 2026 Predictor Soccer Souls</h1>
                <nav>
                    <button onClick={silentRefresh} className="outline" style={{marginRight: '0.5rem'}}>Refresh ↻</button>
                    <button onClick={() => setView('dashboard')}>Matches</button>
                    <button onClick={() => setView('leaderboard')}>Leaderboard</button>
                    {currentUser === 'Mahad' && <button onClick={() => setView('admin')}>Admin</button>}
                    <button onClick={logout} className="outline">Logout</button>
                </nav>
            </header>
            <main>
                {view === 'dashboard' && (
                    <div>
                        <h2 style={{fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem'}}>Dashboard - {currentUser}</h2>
                        {matches.map(m => {
                            const pred = predictions[`${m.id}-${currentUser}`];
                            const lockTime = new Date(new Date(m.date).getTime() - 30 * 60000); // 30 mins before
                            const locked = new Date() > lockTime;
                            const res = results[m.id];
                            return (
                                <div key={m.id} className="card">
                                    <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '1rem'}}>
                                        <span>{m.group}</span>
                                        <span>{formatDate(m.date)} {locked ? '🔒' : ''}</span>
                                    </div>
                                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600}}>
                                        <div style={{flex: 1, textAlign: 'center'}}>{m.team1}</div>
                                        <div style={{color: 'var(--text-muted)', fontSize: '0.875rem', padding: '0 1rem'}}>VS</div>
                                        <div style={{flex: 1, textAlign: 'center'}}>{m.team2}</div>
                                    </div>
                                    {res ? (
                                        <div style={{textAlign: 'center'}}>
                                            <div style={{color: 'var(--text-muted)', marginBottom: '0.5rem'}}>Final Score: {res.t1} - {res.t2}</div>
                                            <div style={{color: 'var(--success)'}}>
                                                Your Prediction: {pred ? `${pred.t1}-${pred.t2}` : 'None'} 
                                                <span style={{background: 'var(--primary)', color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem', fontSize: '0.75rem'}}>Earned: {calculatePoints(pred, res)} pts</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem'}}>
                                                <input type="number" id={`pred-t1-${m.id}`} defaultValue={pred ? pred.t1 : ''} disabled={locked} min="0" />
                                                <span style={{color: 'var(--text-muted)'}}>-</span>
                                                <input type="number" id={`pred-t2-${m.id}`} defaultValue={pred ? pred.t2 : ''} disabled={locked} min="0" />
                                                {!locked && <button className="save-btn" onClick={() => savePrediction(m.id)}>Save</button>}
                                            </div>
                                            {pred && !locked && <div style={{textAlign: 'center', color: 'var(--success)', marginTop: '1rem'}}>Prediction Saved ✓</div>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {view === 'leaderboard' && (() => {
                    const userList = Object.keys(users);
                    const scores = {};
                    userList.forEach(u => scores[u] = 0);
                    Object.keys(results).forEach(matchId => {
                        const res = results[matchId];
                        userList.forEach(u => {
                            const pred = predictions[`${matchId}-${u}`];
                            scores[u] += calculatePoints(pred, res);
                        });
                    });
                    const sortedUsers = [...userList].sort((a, b) => scores[b] - scores[a]);
                    
                    return (
                        <div className="card">
                            <h2 style={{color: 'var(--primary)', marginBottom: '1rem'}}>Leaderboard</h2>
                            <table style={{width: '100%', borderCollapse: 'collapse'}}>
                                <tbody>
                                    <tr style={{textAlign: 'left', color: 'var(--text-muted)', borderBottom: '1px solid #334155'}}>
                                        <th style={{padding: '1rem'}}>Rank</th><th style={{padding: '1rem'}}>Player</th><th style={{padding: '1rem'}}>Points</th>
                                    </tr>
                                    {sortedUsers.map((u, idx) => (
                                        <tr key={u} style={{borderBottom: '1px solid #334155'}}>
                                            <td style={{padding: '1rem', color: idx === 0 ? '#ffd700' : idx === 1 ? '#c0c0c0' : idx === 2 ? '#cd7f32' : '', fontWeight: idx < 3 ? 800 : 'normal'}}>#{idx + 1}</td>
                                            <td style={{padding: '1rem', fontWeight: 600}}>{u} {u === currentUser ? '(You)' : ''}</td>
                                            <td style={{padding: '1rem', fontWeight: 'bold', color: 'var(--primary)'}}>{scores[u]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    );
                })()}

                {view === 'admin' && currentUser === 'Mahad' && (
                    <div>
                        <div className="card" style={{marginBottom: '2rem'}}>
                            <h2 style={{color: 'var(--primary)', marginBottom: '1rem'}}>User Passwords</h2>
                            <div style={{display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap'}}>
                                <input type="text" placeholder="New Player Name" value={newUser} onChange={e => setNewUser(e.target.value)} style={{padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db', color: '#000', flex: 1, minWidth: '150px'}} />
                                <button onClick={addUser}>Add User</button>
                            </div>
                            <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1rem'}}>
                                {Object.keys(users).map(u => (
                                    <div key={u}><strong>{u}:</strong> <span style={{fontFamily: 'monospace', background: '#e5e7eb', padding: '0.2rem 0.4rem', borderRadius: '4px'}}>{users[u]}</span></div>
                                ))}
                            </div>
                        </div>

                        <h2 style={{fontSize: '1.25rem', color: 'var(--primary)', marginBottom: '1.5rem'}}>Admin - Enter Actual Results</h2>
                        {matches.map(m => {
                            const res = results[m.id];
                            return (
                                <div key={m.id} style={{marginBottom: '1rem'}}>
                                    <div className="card" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                                        <div>
    <div style={{fontWeight: 'bold'}}>
        {m.team1} vs {m.team2}
    </div>

    <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
        {formatDate(m.date)}
    </div>

    <div style={{fontSize: '0.7rem', color: '#94a3b8'}}>
        Match ID: {m.id}
    </div>
</div>
                                        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap'}}>
                                            <input type="number" id={`res-t1-${m.id}`} defaultValue={res ? res.t1 : ''} style={{width: '50px'}} min="0" />
                                            -
                                            <input type="number" id={`res-t2-${m.id}`} defaultValue={res ? res.t2 : ''} style={{width: '50px'}} min="0" />
                                            <button className="save-btn" onClick={() => saveResult(m.id)}>
                                                {adminFeedback[m.id] ? 'Saved ✓' : 'Save Score'}
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{marginTop: '1rem', padding: '1rem', background: 'var(--bg-color)', borderRadius: '8px', fontSize: '0.9rem'}}>
                                        <strong style={{color: 'var(--primary)'}}>Predictions:</strong>
                                        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem'}}>
                                            {Object.keys(users).filter(u => predictions[`${m.id}-${u}`]).map(u => (
                                                <div key={u}><strong>{u}:</strong> {predictions[`${m.id}-${u}`].t1} - {predictions[`${m.id}-${u}`].t2}</div>
                                            ))}
                                            {Object.keys(users).filter(u => predictions[`${m.id}-${u}`]).length === 0 && <div style={{color: 'var(--text-muted)'}}>No predictions yet.</div>}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </>
    );
}
