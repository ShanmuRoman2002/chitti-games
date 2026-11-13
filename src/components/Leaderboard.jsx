import React, { useEffect, useState } from 'react';

/**
 * Leaderboard Component - IPL-Style Points Table
 * Displays rectangular row bars, ranks top 4 qualifiers, sorts by points & goals scored.
 */
export default function Leaderboard({ onNavigateBack }) {
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) {
        const data = await res.json();
        setStandings(data);
      }
    } catch (err) {
      console.warn('Error loading leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🏆</span>
          <div>
            <h1 style={styles.brandTitle}>Robot Soccer Scoreboard</h1>
            <div style={styles.brandSub}>Tournament Standings & Leaderboard</div>
          </div>
        </div>
        <nav style={styles.navLinks}>
          <a href="/dashboard" style={styles.navLink}>📋 Dashboard</a>
          <a href="/match" style={styles.navLink}>⚔️ Matchmaker</a>
          <span style={{ ...styles.navLink, ...styles.navLinkActive }}>🏆 Leaderboard</span>
          <a href="/control" style={styles.navLink}>🎮 Control Panel</a>
          <a href="/display" target="_blank" rel="noreferrer" style={styles.navLink}>📺 TV Display</a>
        </nav>
      </header>

      <div style={styles.container}>
        {/* Table Hero Header */}
        <div style={styles.heroCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={styles.trophyBadge}>🏆</div>
            <div>
              <h2 style={styles.heroTitle}>IPL-Style Points Table</h2>
              <p style={styles.heroSub}>
                Rankings dynamically computed by Points (PTS) then Goals Scored (GS).
              </p>
            </div>
          </div>
          <div>
            <a href="/match" style={styles.playNextBtn}>⚔️ Play Next Match</a>
          </div>
        </div>

        {/* Table Wrapper */}
        <div style={styles.tableWrapper}>
          <div style={styles.tableHead}>
            <div style={{ textAlign: 'center' }}>POS</div>
            <div style={{ textAlign: 'left', paddingLeft: '12px' }}>TEAM</div>
            <div style={{ textAlign: 'center' }}>P</div>
            <div style={{ textAlign: 'center' }}>W</div>
            <div style={{ textAlign: 'center' }}>L</div>
            <div style={{ textAlign: 'center' }}>D</div>
            <div style={{ textAlign: 'center' }}>GS</div>
            <div style={{ textAlign: 'center' }}>PEN</div>
            <div style={{ textAlign: 'center', color: '#fbbf24' }}>PTS</div>
          </div>

          <div style={styles.rowsList}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                Loading standings...
              </div>
            ) : standings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                No matches completed yet.
              </div>
            ) : (
              standings.map((team, idx) => {
                const rank = idx + 1;
                const isRank1 = rank === 1;
                const isRank2 = rank === 2;
                const isRank3 = rank === 3;
                const isRank4 = rank === 4;

                const borderColor = isRank1
                  ? '#fbbf24'
                  : isRank2
                  ? '#94a3b8'
                  : isRank3
                  ? '#d97706'
                  : isRank4
                  ? '#3b82f6'
                  : '#1f2937';

                return (
                  <div
                    key={team.id || idx}
                    style={{
                      ...styles.rowBar,
                      borderLeft: `4px solid ${borderColor}`,
                      background: isRank1
                        ? 'linear-gradient(90deg, rgba(251, 191, 36, 0.08), #161f30 40%)'
                        : '#161f30'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div
                        style={{
                          ...styles.rankBadge,
                          borderColor,
                          color: isRank1 ? '#fbbf24' : '#f1f5f9'
                        }}
                      >
                        {rank}
                      </div>
                    </div>

                    <div style={styles.teamCol}>
                      <div style={styles.logoCircle}>
                        {team.logo &&
                        (team.logo.startsWith('/') ||
                          team.logo.startsWith('http') ||
                          team.logo.startsWith('data:image')) ? (
                          <img
                            src={team.logo}
                            alt={team.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <span style={{ fontSize: '1.4rem' }}>{team.logo || '🤖'}</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={styles.teamNameText}>{team.name || team.teamName}</div>
                        {(team.student1?.name || team.student2?.name) && (
                          <div style={styles.studentSubText}>
                            👥 {[team.student1?.name, team.student2?.name].filter(Boolean).join(' & ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={styles.statCell}>{team.played || 0}</div>
                    <div style={{ ...styles.statCell, color: '#22c55e', fontWeight: 700 }}>
                      {team.won || 0}
                    </div>
                    <div style={{ ...styles.statCell, color: '#ef4444' }}>{team.lost || 0}</div>
                    <div style={styles.statCell}>{team.drawn || 0}</div>
                    <div style={styles.statCell}>{team.goals_scored || 0}</div>
                    <div style={styles.statCell}>{team.penalties || 0}</div>
                    <div
                      style={{
                        ...styles.statCell,
                        fontFamily: 'Orbitron, monospace',
                        fontWeight: 900,
                        color: '#fbbf24',
                        fontSize: '1.25rem'
                      }}
                    >
                      {team.points || 0}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  container: { maxWidth: '1200px', margin: '0 auto' },
  heroCard: {
    background: 'linear-gradient(135deg, rgba(22, 31, 48, 0.95), rgba(17, 24, 39, 0.95))',
    border: '1px solid #30363d',
    borderRadius: '14px',
    padding: '24px',
    marginBottom: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '16px'
  },
  trophyBadge: {
    width: '54px',
    height: '54px',
    borderRadius: '12px',
    background: 'radial-gradient(circle, rgba(251, 191, 36, 0.2), rgba(17, 24, 39, 0.8))',
    border: '2px solid #fbbf24',
    color: '#fbbf24',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.8rem'
  },
  heroTitle: { fontSize: '1.5rem', fontWeight: 800, margin: 0, textTransform: 'uppercase' },
  heroSub: { fontSize: '0.85rem', color: '#94a3b8', margin: '4px 0 0' },
  playNextBtn: {
    padding: '8px 16px',
    borderRadius: '8px',
    border: '1px solid #fbbf24',
    background: 'rgba(251,191,36,0.15)',
    color: '#fbbf24',
    fontWeight: 700,
    textDecoration: 'none',
    fontSize: '0.9rem'
  },
  tableWrapper: {
    backgroundColor: '#111827',
    border: '1px solid #30363d',
    borderRadius: '14px',
    padding: '16px',
    overflowX: 'auto'
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '70px 1fr 70px 70px 70px 70px 85px 85px 95px',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: 'rgba(13, 17, 23, 0.8)',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#94a3b8',
    marginBottom: '8px'
  },
  rowsList: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rowBar: {
    display: 'grid',
    gridTemplateColumns: '70px 1fr 70px 70px 70px 70px 85px 85px 95px',
    alignItems: 'center',
    padding: '14px 16px',
    borderRadius: '10px',
    border: '1px solid #1f2937'
  },
  rankBadge: {
    width: '34px',
    height: '34px',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'Orbitron, monospace',
    fontWeight: 800,
    border: '1px solid'
  },
  teamCol: { display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '12px', minWidth: 0 },
  logoCircle: {
    width: '42px',
    height: '42px',
    borderRadius: '50%',
    backgroundColor: '#080c14',
    border: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  },
  teamNameText: { fontWeight: 700, fontSize: '1.15rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  studentSubText: { fontSize: '0.78rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  statCell: { textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }
};

