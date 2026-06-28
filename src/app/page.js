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
    const [adminSort, setAdminSort] = useState('total');

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

    const getSeeds = () => {
        const gsScores = {};
        const userList = Object.keys(users);
        userList.forEach(u => gsScores[u] = 0);
        
        matches.forEach(m => {
            if (m.group.startsWith('Group') && results[m.id]) {
                const res = results[m.id];
                userList.forEach(u => {
                    const pred = predictions[`${m.id}-${u}`];
                    gsScores[u] += calculatePoints(pred, res);
                });
            }
        });
        
        const sortedUsers = [...userList].sort((a, b) => gsScores[b] - gsScores[a]);
        return sortedUsers;
    };

                {view === 'knockout' && (() => {
                    const seedsList = getSeeds();
                    
                    const r32Seeds = [
                        [1, 32], [16, 17], [9, 24], [8, 25],
                        [4, 29], [13, 20], [12, 21], [5, 28],
                        [2, 31], [15, 18], [10, 23], [7, 26],
                        [3, 30], [14, 19], [11, 22], [6, 27]
                    ];

                    const r32Complete = isPhaseComplete('Round of 32');
                    const r16Complete = isPhaseComplete('Round of 16');
                    const qfComplete = isPhaseComplete('Quarter-finals');
                    const sfComplete = isPhaseComplete('Semi-finals');
                    const fComplete = isPhaseComplete('Final');

                    const getWinner = (u1, u2, s1, s2, phase, complete) => {
                        if (!u1) return u2;
                        if (!u2) return u1;
                        if (!complete) return null;
                        return getMatchLeader(u1, u2, s1, s2, phase);
                    };

                    const r32Matches = r32Seeds.map((pair, idx) => {
                        const s1 = pair[0];
                        const s2 = pair[1];
                        const u1 = s1 <= 26 ? seedsList[s1 - 1] : null;
                        const u2 = s2 <= 26 ? seedsList[s2 - 1] : null;
                        const leader = getMatchLeader(u1, u2, s1, s2, 'Round of 32');
                        const winner = getWinner(u1, u2, s1, s2, 'Round of 32', r32Complete);
                        return { id: `R32-${idx}`, u1, s1, u2, s2, leader, winner, phase: 'Round of 32' };
                    });

                    const r16Matches = [];
                    for(let i=0; i<8; i++) {
                        const m1 = r32Matches[i*2];
                        const m2 = r32Matches[i*2 + 1];
                        const u1 = m1.winner;
                        const u2 = m2.winner;
                        const s1 = u1 ? (m1.u1 === u1 ? m1.s1 : m1.s2) : null;
                        const s2 = u2 ? (m2.u1 === u2 ? m2.s1 : m2.s2) : null;
                        const leader = getMatchLeader(u1, u2, s1, s2, 'Round of 16');
                        const winner = getWinner(u1, u2, s1, s2, 'Round of 16', r16Complete);
                        r16Matches.push({ id: `R16-${i}`, u1, s1, u2, s2, leader, winner, phase: 'Round of 16' });
                    }

                    const qfMatches = [];
                    for(let i=0; i<4; i++) {
                        const m1 = r16Matches[i*2];
                        const m2 = r16Matches[i*2 + 1];
                        const u1 = m1.winner;
                        const u2 = m2.winner;
                        const s1 = u1 ? (m1.u1 === u1 ? m1.s1 : m1.s2) : null;
                        const s2 = u2 ? (m2.u1 === u2 ? m2.s1 : m2.s2) : null;
                        const leader = getMatchLeader(u1, u2, s1, s2, 'Quarter-finals');
                        const winner = getWinner(u1, u2, s1, s2, 'Quarter-finals', qfComplete);
                        qfMatches.push({ id: `QF-${i}`, u1, s1, u2, s2, leader, winner, phase: 'Quarter-finals' });
                    }

                    const sfMatches = [];
                    for(let i=0; i<2; i++) {
                        const m1 = qfMatches[i*2];
                        const m2 = qfMatches[i*2 + 1];
                        const u1 = m1.winner;
                        const u2 = m2.winner;
                        const s1 = u1 ? (m1.u1 === u1 ? m1.s1 : m1.s2) : null;
                        const s2 = u2 ? (m2.u1 === u2 ? m2.s1 : m2.s2) : null;
                        const leader = getMatchLeader(u1, u2, s1, s2, 'Semi-finals');
                        const winner = getWinner(u1, u2, s1, s2, 'Semi-finals', sfComplete);
                        sfMatches.push({ id: `SF-${i}`, u1, s1, u2, s2, leader, winner, phase: 'Semi-finals' });
                    }

                    const f_m1 = sfMatches[0];
                    const f_m2 = sfMatches[1];
                    const f_u1 = f_m1.winner;
                    const f_u2 = f_m2.winner;
                    const f_s1 = f_u1 ? (f_m1.u1 === f_u1 ? f_m1.s1 : f_m1.s2) : null;
                    const f_s2 = f_u2 ? (f_m2.u1 === f_u2 ? f_m2.s1 : f_m2.s2) : null;
                    const f_leader = getMatchLeader(f_u1, f_u2, f_s1, f_s2, 'Final');
                    const f_winner = getWinner(f_u1, f_u2, f_s1, f_s2, 'Final', fComplete);
                    const finalMatch = { id: `F-0`, u1: f_u1, s1: f_s1, u2: f_u2, s2: f_s2, leader: f_leader, winner: f_winner, phase: 'Final' };

                    const rounds = [
                        { name: 'Round of 32', matches: r32Matches },
                        { name: 'Round of 16', matches: r16Matches },
                        { name: 'Quarter-finals', matches: qfMatches },
                        { name: 'Semi-finals', matches: sfMatches },
                        { name: 'Final', matches: [finalMatch] }
                    ];

                    const renderMatchCard = (m) => {
                        const st1 = m.u1 ? getPhaseStats(m.u1, m.phase) : { pts: 0, exacts: 0 };
                        const st2 = m.u2 ? getPhaseStats(m.u2, m.phase) : { pts: 0, exacts: 0 };
                        
                        const name1 = m.u1 || (m.phase === 'Round of 32' ? 'Bye' : 'TBD');
                        const name2 = m.u2 || (m.phase === 'Round of 32' ? 'Bye' : 'TBD');
                        
                        return (
                            <div className="card" style={{margin: '0.5rem 0', width: '220px', fontSize: '0.9rem', padding: '1rem', borderLeft: '4px solid var(--primary)', position: 'relative', zIndex: 2}}>
                                <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '0.5rem'}}>
                                    <div style={{fontWeight: m.leader === m.u1 && m.u1 ? 'bold' : 'normal', color: m.leader === m.u1 && m.u1 ? 'var(--success)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                        {m.s1 && <span style={{color: '#9ca3af', fontSize: '0.75rem', marginRight: '0.4rem'}}>#{m.s1}</span>}
                                        {name1}
                                    </div>
                                    {m.u1 && m.u2 && <div style={{fontWeight: 'bold', fontSize: '0.8rem'}}>{st1.pts}</div>}
                                </div>
                                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                                    <div style={{fontWeight: m.leader === m.u2 && m.u2 ? 'bold' : 'normal', color: m.leader === m.u2 && m.u2 ? 'var(--success)' : 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>
                                        {m.s2 && <span style={{color: '#9ca3af', fontSize: '0.75rem', marginRight: '0.4rem'}}>#{m.s2}</span>}
                                        {name2}
                                    </div>
                                    {m.u1 && m.u2 && <div style={{fontWeight: 'bold', fontSize: '0.8rem'}}>{st2.pts}</div>}
                                </div>
                            </div>
                        );
                    };

                    return (
                        <div style={{overflowX: 'auto', padding: '1rem 0', background: 'var(--card-bg)', borderRadius: '8px', border: '1px solid #e5e7eb'}}>
                            <div style={{display: 'flex', gap: '3rem', minWidth: 'max-content', padding: '1rem'}}>
                                {rounds.map((round, rIdx) => (
                                    <div key={round.name} style={{display: 'flex', flexDirection: 'column'}}>
                                        <h3 style={{textAlign: 'center', color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem', height: '2rem'}}>{round.name}</h3>
                                        
                                        <div style={{display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-around'}}>
                                            {(() => {
                                                if (rIdx === rounds.length - 1) {
                                                    return round.matches.map(m => <div key={m.id} style={{display: 'flex', alignItems: 'center', flexGrow: 1}}>{renderMatchCard(m)}</div>);
                                                }
                                                
                                                const pairs = [];
                                                for(let i=0; i<round.matches.length; i+=2) {
                                                    pairs.push([round.matches[i], round.matches[i+1]]);
                                                }
                                                
                                                return pairs.map((pair, pIdx) => (
                                                    <div key={pIdx} style={{position: 'relative', display: 'flex', flexDirection: 'column', flexGrow: 1, justifyContent: 'space-around', margin: '0.5rem 0'}}>
                                                        <div style={{display: 'flex', alignItems: 'center'}}>{renderMatchCard(pair[0])}</div>
                                                        <div style={{display: 'flex', alignItems: 'center'}}>{renderMatchCard(pair[1])}</div>
                                                        
                                                        {/* Connector to next round */}
                                                        <div style={{position: 'absolute', right: '-1.5rem', top: '25%', bottom: '25%', width: '1.5rem', borderRight: '2px solid #cbd5e1', borderTop: '2px solid #cbd5e1', borderBottom: '2px solid #cbd5e1', zIndex: 1, pointerEvents: 'none'}}></div>
                                                        <div style={{position: 'absolute', right: '-3rem', top: '50%', width: '1.5rem', borderTop: '2px solid #cbd5e1', zIndex: 1, pointerEvents: 'none'}}></div>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })()}

                {view === 'admin' && currentUser === 'Mahad' && (
                    <div>
                        <div className="card" style={{marginBottom: '2rem'}}>
                            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem'}}>
                                <h2 style={{color: 'var(--primary)', margin: 0}}>Player Stats (Completed Games)</h2>
                                <select value={adminSort} onChange={e => setAdminSort(e.target.value)} style={{padding: '0.5rem', borderRadius: '6px', background: 'transparent', color: 'inherit', border: '1px solid #334155'}}>
                                    <option value="total" style={{color: '#000'}}>Sort by Total Points</option>
                                    <option value="average" style={{color: '#000'}}>Sort by Points Average</option>
                                </select>
                            </div>
                            <div style={{overflowX: 'auto'}}>
                                <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '400px'}}>
                                    <thead>
                                        <tr style={{borderBottom: '1px solid #334155', color: 'var(--text-muted)'}}>
                                            <th style={{padding: '0.5rem'}}>#</th>
                                            <th style={{padding: '0.5rem'}}>Player</th>
                                            <th style={{padding: '0.5rem'}}>Total Points</th>
                                            <th style={{padding: '0.5rem'}}>Predicted</th>
                                            <th style={{padding: '0.5rem'}}>Average</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(() => {
                                            const adminScores = {};
                                            const adminGames = {};
                                            Object.keys(users).forEach(u => { adminScores[u] = 0; adminGames[u] = 0; });
                                            Object.keys(results).forEach(matchId => {
                                                const res = results[matchId];
                                                Object.keys(users).forEach(u => {
                                                    const pred = predictions[`${matchId}-${u}`];
                                                    if (pred) {
                                                        adminGames[u] += 1;
                                                        adminScores[u] += calculatePoints(pred, res);
                                                    }
                                                });
                                            });
                                            const getAvg = (u) => adminGames[u] > 0 ? (adminScores[u] / adminGames[u]) : 0;
                                            
                                            const sortedAdminUsers = Object.keys(users).sort((a, b) => {
                                                if (adminSort === 'average') {
                                                    return getAvg(b) - getAvg(a);
                                                }
                                                return adminScores[b] - adminScores[a];
                                            });

                                            return sortedAdminUsers.map((u, idx) => {
                                                const avg = adminGames[u] > 0 ? getAvg(u).toFixed(2) : '0.00';
                                                return (
                                                    <tr key={u} style={{borderBottom: '1px solid #334155'}}>
                                                        <td style={{padding: '0.5rem', color: 'var(--text-muted)'}}>{idx + 1}.</td>
                                                        <td style={{padding: '0.5rem'}}>{u}</td>
                                                        <td style={{padding: '0.5rem', color: 'var(--primary)', fontWeight: 'bold'}}>{adminScores[u]}</td>
                                                        <td style={{padding: '0.5rem'}}>{adminGames[u]}</td>
                                                        <td style={{padding: '0.5rem'}}>{avg}</td>
                                                    </tr>
                                                );
                                            });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                        </div>

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
