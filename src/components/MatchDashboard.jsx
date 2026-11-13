import React, { useState } from 'react';
import { useTeamContext } from '../context/TeamContext';

/**
 * MatchDashboard Component - Match-Making Arena & VS Setup
 * Split screen layout: Left = Team Pool, Right = Match Setup & START MATCH
 */
export default function MatchDashboard({ onNavigateToControl, onNavigateToDashboard }) {
  const {
    teams,
    selectedTeamA,
    selectedTeamB,
    selectTeam,
    removeSelectedTeam,
    swapTeams,
    startMatch,
    matchDuration,
    setMatchDuration
  } = useTeamContext();

  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState(false);
  const [statusText, setStatusText] = useState(null);

  // Filter pool
  const filteredPool = teams.filter((t) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.student1?.name || '').toLowerCase().includes(q) ||
      (t.student2?.name || '').toLowerCase().includes(q)
    );
  });

  const handleStart = async () => {
    if (!selectedTeamA || !selectedTeamB) {
      alert('Please select both Team A and Team B before starting the match.');
      return;
    }

    setStarting(true);
    setStatusText('Transmitting team data to Control Panel and TV Display...');
    try {
      await startMatch((redirectUrl) => {
        if (onNavigateToControl) {
          onNavigateToControl({
            teamA: selectedTeamA,
            teamB: selectedTeamB,
            redirect: redirectUrl
          });
        } else {
          window.location.href = redirectUrl || '/control';
        }
      });
    } catch (err) {
      alert(err.message || 'Failed to start match');
      setStarting(false);
      setStatusText(null);
    }
  };

  const isReady = selectedTeamA && selectedTeamB;

  return (
    <div style={styles.page}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>⚔️</span>
          <div>
            <h1 style={styles.brandTitle}>Robot Soccer Scoreboard</h1>
            <div style={styles.brandSub}>Match-Making Arena</div>
          </div>
        </div>
        <nav style={styles.navLinks}>
          <button
            onClick={() => (onNavigateToDashboard ? onNavigateToDashboard() : (window.location.href = '/dashboard'))}
            style={styles.navLink}
          >
            📋 Dashboard
          </button>
          <span style={{ ...styles.navLink, ...styles.navLinkActive }}>⚔️ Matchmaker</span>
          <a href="/leaderboard" style={styles.navLink}>
            🏆 Leaderboard
          </a>
          <a href="/control" style={styles.navLink}>
            🎮 Control Panel
          </a>
          <a href="/display" target="_blank" rel="noreferrer" style={styles.navLink}>
            📺 TV Display
          </a>
        </nav>
      </header>

      {/* Main Split Grid */}
      <main style={styles.splitGrid}>
        {/* Left Side: Team Pool */}
        <section style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.2rem' }}>👥</span>
              <h2 style={styles.panelTitle}>Team Pool</h2>
              <span style={styles.poolCountBadge}>{teams.length} Teams</span>
            </div>
            <button
              onClick={() => (onNavigateToDashboard ? onNavigateToDashboard() : (window.location.href = '/dashboard'))}
              style={styles.btnAddMore}
            >
              + Register
            </button>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <input
              type="text"
              placeholder="Search team or student..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.poolSearchInput}
            />
          </div>

          <div style={styles.poolList}>
            {filteredPool.length === 0 ? (
              <div style={styles.emptyPool}>
                <p>No teams available.</p>
                <button
                  onClick={() => (onNavigateToDashboard ? onNavigateToDashboard() : (window.location.href = '/dashboard'))}
                  style={styles.btnSecondary}
                >
                  Register Teams in Dashboard
                </button>
              </div>
            ) : (
              filteredPool.map((t) => {
                const isSelectedA = selectedTeamA?.id === t.id;
                const isSelectedB = selectedTeamB?.id === t.id;
                const isSelected = isSelectedA || isSelectedB;

                return (
                  <div
                    key={t.id}
                    style={{
                      ...styles.poolItem,
                      borderColor: isSelectedA ? '#3b82f6' : isSelectedB ? '#ef4444' : '#30363d',
                      backgroundColor: isSelectedA
                        ? 'rgba(59,130,246,0.1)'
                        : isSelectedB
                        ? 'rgba(239,68,68,0.1)'
                        : '#161f30'
                    }}
                  >
                    <div style={styles.poolItemLeft}>
                      <div style={styles.poolLogoBox}>
                        {t.logo &&
                        (t.logo.startsWith('/') ||
                          t.logo.startsWith('http') ||
                          t.logo.startsWith('data:image')) ? (
                          <img src={t.logo} alt={t.teamName || t.name} style={styles.logoImg} />
                        ) : (
                          <span style={{ fontSize: '1.4rem' }}>{t.logo || '🤖'}</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.poolTeamName}>{t.teamName || t.name}</div>
                        <div style={styles.poolStudentNames}>
                          👥 {[t.student1?.name, t.student2?.name].filter(Boolean).join(' & ') || 'Student Pair'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => selectTeam(t)}
                      style={{
                        ...styles.btnPoolSelect,
                        backgroundColor: isSelectedA ? 'rgba(59,130,246,0.2)' : isSelectedB ? 'rgba(239,68,68,0.2)' : '#0d1117',
                        borderColor: isSelectedA ? '#3b82f6' : isSelectedB ? '#ef4444' : '#30363d',
                        color: isSelectedA ? '#3b82f6' : isSelectedB ? '#ef4444' : '#e6edf3'
                      }}
                    >
                      {isSelectedA ? '✓ Team A' : isSelectedB ? '✓ Team B' : '＋ Add/Select'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Right Side: Match Setup */}
        <section style={{ ...styles.panel, justifyContent: 'space-between' }}>
          <div>
            <div style={styles.panelHeader}>
              <div>
                <h2 style={styles.panelTitle}>🏟️ Match Setup & VS Arena</h2>
                <div style={{ fontSize: '0.85rem', color: '#94a3b8', marginTop: '2px' }}>
                  Select two competing teams to battle in the arena.
                </div>
              </div>
            </div>

            {/* VS Arena Containers */}
            <div style={styles.vsContainer}>
              {/* Slot A (Blue Corner) */}
              <div
                style={{
                  ...styles.matchSlot,
                  borderColor: selectedTeamA ? '#3b82f6' : 'rgba(59,130,246,0.4)',
                  boxShadow: selectedTeamA ? '0 0 24px rgba(59,130,246,0.2)' : 'none'
                }}
              >
                <span style={{ ...styles.slotCornerBadge, ...styles.cornerBadgeA }}>🔵 Team A (Blue)</span>
                {selectedTeamA && (
                  <button onClick={() => removeSelectedTeam('a')} style={styles.slotRemoveBtn}>
                    ✕ Clear
                  </button>
                )}

                {selectedTeamA ? (
                  <div style={styles.populatedSlot}>
                    <div style={{ ...styles.slotLogoBig, borderColor: '#3b82f6' }}>
                      {selectedTeamA.logo &&
                      (selectedTeamA.logo.startsWith('/') ||
                        selectedTeamA.logo.startsWith('http') ||
                        selectedTeamA.logo.startsWith('data:image')) ? (
                        <img src={selectedTeamA.logo} alt={selectedTeamA.name} style={styles.logoImg} />
                      ) : (
                        <span style={{ fontSize: '3rem' }}>{selectedTeamA.logo || '🤖'}</span>
                      )}
                    </div>
                    <div style={styles.slotTeamTitle}>{selectedTeamA.name}</div>
                    <div style={styles.slotStudentsBadge}>
                      👥 {[selectedTeamA.student1?.name, selectedTeamA.student2?.name].filter(Boolean).join(' & ')}
                    </div>
                  </div>
                ) : (
                  <div style={styles.placeholderSlot}>
                    <div style={{ fontSize: '3.5rem', opacity: 0.35, marginBottom: '6px' }}>🤖</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#3b82f6' }}>Select Team A</div>
                    <div style={{ fontSize: '0.8rem', color: '#8b949e', maxWidth: '180px' }}>
                      Click 'Add/Select' on any team in the left pool.
                    </div>
                  </div>
                )}
              </div>

              {/* Center VS Element */}
              <div style={styles.vsCenter}>
                <div style={styles.vsBadge}>VS</div>
                <button onClick={swapTeams} style={styles.btnSwap} title="Swap Teams">
                  ⇄ Swap
                </button>
              </div>

              {/* Slot B (Red Corner) */}
              <div
                style={{
                  ...styles.matchSlot,
                  borderColor: selectedTeamB ? '#ef4444' : 'rgba(239,68,68,0.4)',
                  boxShadow: selectedTeamB ? '0 0 24px rgba(239,68,68,0.2)' : 'none'
                }}
              >
                <span style={{ ...styles.slotCornerBadge, ...styles.cornerBadgeB }}>🔴 Team B (Red)</span>
                {selectedTeamB && (
                  <button onClick={() => removeSelectedTeam('b')} style={styles.slotRemoveBtn}>
                    ✕ Clear
                  </button>
                )}

                {selectedTeamB ? (
                  <div style={styles.populatedSlot}>
                    <div style={{ ...styles.slotLogoBig, borderColor: '#ef4444' }}>
                      {selectedTeamB.logo &&
                      (selectedTeamB.logo.startsWith('/') ||
                        selectedTeamB.logo.startsWith('http') ||
                        selectedTeamB.logo.startsWith('data:image')) ? (
                        <img src={selectedTeamB.logo} alt={selectedTeamB.name} style={styles.logoImg} />
                      ) : (
                        <span style={{ fontSize: '3rem' }}>{selectedTeamB.logo || '🤖'}</span>
                      )}
                    </div>
                    <div style={styles.slotTeamTitle}>{selectedTeamB.name}</div>
                    <div style={styles.slotStudentsBadge}>
                      👥 {[selectedTeamB.student1?.name, selectedTeamB.student2?.name].filter(Boolean).join(' & ')}
                    </div>
                  </div>
                ) : (
                  <div style={styles.placeholderSlot}>
                    <div style={{ fontSize: '3.5rem', opacity: 0.35, marginBottom: '6px' }}>🤖</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#ef4444' }}>Select Team B</div>
                    <div style={{ fontSize: '0.8rem', color: '#8b949e', maxWidth: '180px' }}>
                      Click 'Add/Select' on a second team in the left pool.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Match Options */}
            <div style={styles.matchOptions}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontWeight: 600 }}>DURATION:</span>
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    onClick={() => setMatchDuration(m * 60)}
                    style={{
                      ...styles.durBtn,
                      borderColor: matchDuration === m * 60 ? '#3b82f6' : '#30363d',
                      color: matchDuration === m * 60 ? '#3b82f6' : '#94a3b8',
                      background: matchDuration === m * 60 ? 'rgba(59,130,246,0.15)' : '#0d1117'
                    }}
                  >
                    {m}m
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Scores and timer reset on match start.
              </div>
            </div>
          </div>

          {/* Large START MATCH Button */}
          <div style={{ marginTop: '16px' }}>
            <button
              onClick={handleStart}
              disabled={!isReady || starting}
              style={{
                ...styles.btnStartMatch,
                background: isReady ? 'linear-gradient(135deg, #16a34a, #22c55e)' : '#1f2937',
                color: isReady ? '#000' : '#4b5563',
                cursor: isReady ? 'pointer' : 'not-allowed'
              }}
            >
              <span>⚡</span>
              <span>
                {starting
                  ? 'INITIALIZING MATCH...'
                  : isReady
                  ? `START MATCH: ${selectedTeamA.name} VS ${selectedTeamB.name}`
                  : 'SELECT 2 TEAMS TO START'}
              </span>
              <span>➔</span>
            </button>
            {statusText && <div style={styles.statusFeedback}>{statusText}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}

// ── Styles matching sports/scoreboard theme ─────────────────────────
const styles = {
  page: {
    backgroundColor: '#080c14',
    color: '#f1f5f9',
    minHeight: '100vh',
    padding: '16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#111827',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '14px 20px',
    marginBottom: '20px',
    flexWrap: 'wrap',
    gap: '12px'
  },
  brand: { display: 'flex', alignItems: 'center', gap: '12px' },
  brandIcon: { fontSize: '1.8rem' },
  brandTitle: { fontSize: '1.35rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' },
  brandSub: { fontSize: '0.75rem', color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '1.5px' },
  navLinks: { display: 'flex', gap: '8px', alignItems: 'center' },
  navLink: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    color: '#94a3b8',
    background: 'transparent',
    textDecoration: 'none',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  navLinkActive: { borderColor: '#fbbf24', color: '#fbbf24', background: 'rgba(251,191,36,0.15)' },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: 'minmax(320px, 420px) 1fr',
    gap: '20px',
    maxWidth: '1500px',
    margin: '0 auto'
  },
  panel: {
    backgroundColor: '#111827',
    border: '1px solid #30363d',
    borderRadius: '14px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column'
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '12px',
    marginBottom: '14px',
    borderBottom: '1px solid #30363d'
  },
  panelTitle: { fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' },
  poolCountBadge: {
    fontSize: '0.75rem',
    padding: '2px 8px',
    borderRadius: '12px',
    backgroundColor: 'rgba(59,130,246,0.15)',
    border: '1px solid #3b82f6',
    color: '#3b82f6'
  },
  btnAddMore: {
    fontSize: '0.75rem',
    padding: '4px 10px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    backgroundColor: '#161f30',
    color: '#3b82f6',
    cursor: 'pointer'
  },
  poolSearchInput: {
    width: '100%',
    padding: '10px 14px',
    fontSize: '0.85rem',
    backgroundColor: '#080c14',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#f1f5f9',
    outline: 'none',
    boxSizing: 'border-box'
  },
  poolList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: 'calc(100vh - 280px)',
    overflowY: 'auto'
  },
  emptyPool: { textAlign: 'center', padding: '30px 10px', color: '#94a3b8' },
  btnSecondary: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    borderRadius: '6px',
    border: '1px solid #30363d',
    backgroundColor: '#161f30',
    color: '#58a6ff',
    cursor: 'pointer',
    marginTop: '8px'
  },
  poolItem: {
    borderRadius: '10px',
    border: '1px solid #30363d',
    padding: '12px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    transition: 'all 0.2s'
  },
  poolItemLeft: { display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 },
  poolLogoBox: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#080c14',
    border: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden'
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  poolTeamName: { fontSize: '1.1rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  poolStudentNames: { fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btnPoolSelect: {
    padding: '6px 12px',
    fontSize: '0.78rem',
    fontWeight: 700,
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer',
    whiteSpace: 'nowrap'
  },
  vsContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: '16px',
    margin: '20px 0'
  },
  matchSlot: {
    backgroundColor: '#080c14',
    borderRadius: '16px',
    padding: '24px 16px',
    minHeight: '280px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    border: '2px dashed',
    position: 'relative'
  },
  slotCornerBadge: {
    position: 'absolute',
    top: '12px',
    left: '12px',
    fontSize: '0.7rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px'
  },
  cornerBadgeA: { backgroundColor: 'rgba(59,130,246,0.2)', color: '#3b82f6', border: '1px solid #3b82f6' },
  cornerBadgeB: { backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid #ef4444' },
  slotRemoveBtn: {
    position: 'absolute',
    top: '10px',
    right: '10px',
    background: 'none',
    border: '1px solid #30363d',
    color: '#94a3b8',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '0.75rem',
    cursor: 'pointer'
  },
  placeholderSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  populatedSlot: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', width: '100%' },
  slotLogoBig: {
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    border: '3px solid',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
  },
  slotTeamTitle: { fontSize: '1.6rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase' },
  slotStudentsBadge: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    backgroundColor: 'rgba(255,255,255,0.06)',
    padding: '4px 12px',
    borderRadius: '20px'
  },
  vsCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' },
  vsBadge: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#111827',
    border: '2px solid #fbbf24',
    color: '#fbbf24',
    fontSize: '1.4rem',
    fontWeight: 900,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 20px rgba(251,191,36,0.3)'
  },
  btnSwap: {
    padding: '4px 10px',
    fontSize: '0.75rem',
    borderRadius: '16px',
    border: '1px solid #30363d',
    backgroundColor: '#161f30',
    color: '#94a3b8',
    cursor: 'pointer'
  },
  matchOptions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(13,17,23,0.7)',
    border: '1px solid #30363d',
    borderRadius: '10px',
    padding: '12px 16px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  durBtn: {
    padding: '4px 10px',
    fontSize: '0.8rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: '1px solid',
    cursor: 'pointer'
  },
  btnStartMatch: {
    width: '100%',
    padding: '18px 24px',
    fontSize: '1.25rem',
    fontWeight: 900,
    letterSpacing: '1.5px',
    borderRadius: '12px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    boxShadow: '0 8px 24px rgba(34,197,94,0.3)'
  },
  statusFeedback: {
    textAlign: 'center',
    marginTop: '10px',
    fontSize: '0.85rem',
    color: '#3fb950'
  }
};

