import React from 'react';

/**
 * MatchOverview Component - Automated Post-Match Summary Screen
 * Split screen layout: Team 1 vs Team 2 with final scores, stats, and goal event timeline.
 */
export default function MatchOverview({
  match,
  teamA,
  teamB,
  eventTitle = 'Robot Soccer Championship',
  onClose,
  onNewMatch
}) {
  const tA = teamA || { name: 'Team Alpha', score: 0, penalties: 0, logo: null };
  const tB = teamB || { name: 'Team Beta', score: 0, penalties: 0, logo: null };

  const scoreA = tA.score || 0;
  const scoreB = tB.score || 0;
  const penA = tA.penalties || 0;
  const penB = tB.penalties || 0;

  const aWins = scoreA > scoreB;
  const bWins = scoreB > scoreA;
  const isDraw = scoreA === scoreB;

  // Process goal timeline from match.events or match.match_events
  const events = (match && (match.events || match.match_events)) || [];
  const startMs = match && match.startTime ? new Date(match.startTime).getTime() : null;

  const formatSec = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const goalsA = [];
  const goalsB = [];

  events.forEach((ev) => {
    if (ev.type === 'goal') {
      let timeStr = '00:00';
      if (ev.matchTime) {
        timeStr = ev.matchTime;
      } else if (startMs && ev.timestamp) {
        const diffSec = Math.max(0, Math.floor((new Date(ev.timestamp).getTime() - startMs) / 1000));
        timeStr = formatSec(diffSec);
      } else if (ev.timestamp) {
        const d = new Date(ev.timestamp);
        timeStr = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      }

      if (ev.team === 'team1' || ev.team === 'a') {
        goalsA.push({ time: timeStr, score: ev.team1_score });
      } else {
        goalsB.push({ time: timeStr, score: ev.team2_score });
      }
    }
  });

  return (
    <div style={styles.overlay}>
      {/* Background Watermark */}
      <div style={styles.watermark} />

      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.badge}>🏁 Match Completed</div>
          <h1 style={styles.title}>{eventTitle}</h1>
          <div
            style={{
              ...styles.resultBanner,
              color: aWins ? '#93c5fd' : bWins ? '#fca5a5' : '#fbbf24',
              textShadow: aWins
                ? '0 0 25px rgba(59, 130, 246, 0.4)'
                : bWins
                ? '0 0 25px rgba(239, 68, 68, 0.4)'
                : '0 0 25px rgba(251, 191, 36, 0.4)'
            }}
          >
            {aWins
              ? `🏆 ${(tA.name || 'TEAM 1').toUpperCase()} WINS!`
              : bWins
              ? `🏆 ${(tB.name || 'TEAM 2').toUpperCase()} WINS!`
              : '🤝 MATCH DRAWN!'}
          </div>
        </div>

        {/* Split Screen Layout */}
        <div style={styles.split}>
          {/* Team 1 / Left */}
          <div
            style={{
              ...styles.teamCard,
              borderColor: aWins ? '#fbbf24' : 'rgba(59, 130, 246, 0.4)',
              boxShadow: aWins ? '0 0 35px rgba(251, 191, 36, 0.25)' : '0 0 25px rgba(59, 130, 246, 0.15)'
            }}
          >
            <div style={{ ...styles.logoWrap, borderColor: '#3b82f6' }}>
              {tA.logo ? (
                <img src={tA.logo} alt={tA.name} style={styles.logoImg} />
              ) : (
                <span style={{ fontSize: '2.5rem' }}>🤖</span>
              )}
            </div>
            <div style={{ ...styles.teamName, color: '#93c5fd' }}>{tA.name || 'Team 1'}</div>
            <div style={{ ...styles.scoreBig, color: '#93c5fd' }}>{scoreA}</div>

            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Total Goals</div>
                <div style={{ ...styles.statValue, color: '#fbbf24' }}>{scoreA}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Penalties</div>
                <div style={{ ...styles.statValue, color: '#f87171' }}>{penA}</div>
              </div>
            </div>

            {/* Timeline */}
            <div style={styles.timelineSection}>
              <div style={styles.timelineHeading}>
                <span>⚽</span>
                <span>Goal Timeline</span>
              </div>
              <div style={styles.eventsList}>
                {goalsA.length === 0 ? (
                  <div style={styles.eventsEmpty}>No goals scored</div>
                ) : (
                  goalsA.map((g, idx) => (
                    <div key={idx} style={styles.eventPill}>
                      <span>⚽ Goal #{idx + 1}</span>
                      <span style={styles.eventTime}>{g.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Center VS */}
          <div style={styles.centerDivider}>
            <div style={styles.vsCircle}>VS</div>
            <div style={styles.ftLabel}>FULL TIME</div>
          </div>

          {/* Team 2 / Right */}
          <div
            style={{
              ...styles.teamCard,
              borderColor: bWins ? '#fbbf24' : 'rgba(239, 68, 68, 0.4)',
              boxShadow: bWins ? '0 0 35px rgba(251, 191, 36, 0.25)' : '0 0 25px rgba(239, 68, 68, 0.15)'
            }}
          >
            <div style={{ ...styles.logoWrap, borderColor: '#ef4444' }}>
              {tB.logo ? (
                <img src={tB.logo} alt={tB.name} style={styles.logoImg} />
              ) : (
                <span style={{ fontSize: '2.5rem' }}>🤖</span>
              )}
            </div>
            <div style={{ ...styles.teamName, color: '#fca5a5' }}>{tB.name || 'Team 2'}</div>
            <div style={{ ...styles.scoreBig, color: '#fca5a5' }}>{scoreB}</div>

            {/* Stats Grid */}
            <div style={styles.statsGrid}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Total Goals</div>
                <div style={{ ...styles.statValue, color: '#fbbf24' }}>{scoreB}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Penalties</div>
                <div style={{ ...styles.statValue, color: '#f87171' }}>{penB}</div>
              </div>
            </div>

            {/* Timeline */}
            <div style={styles.timelineSection}>
              <div style={styles.timelineHeading}>
                <span>⚽</span>
                <span>Goal Timeline</span>
              </div>
              <div style={styles.eventsList}>
                {goalsB.length === 0 ? (
                  <div style={styles.eventsEmpty}>No goals scored</div>
                ) : (
                  goalsB.map((g, idx) => (
                    <div key={idx} style={styles.eventPill}>
                      <span>⚽ Goal #{idx + 1}</span>
                      <span style={styles.eventTime}>{g.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={styles.footerActions}>
          {onClose && (
            <button onClick={onClose} style={styles.btnSecondary}>
              ✕ Close Summary
            </button>
          )}
          {onNewMatch && (
            <button onClick={onNewMatch} style={styles.btnPrimary}>
              🔄 Setup Next Match
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(8, 12, 20, 0.96)',
    backdropFilter: 'blur(12px)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 950,
    padding: '24px',
    overflowY: 'auto'
  },
  watermark: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundImage: "url('/WhatsApp%20Image%202026-11-12%20at%204.03.54%20PM.jpeg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    opacity: 0.12,
    pointerEvents: 'none',
    zIndex: 0
  },
  content: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1400px',
    width: '100%',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%'
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px'
  },
  badge: {
    display: 'inline-block',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#fbbf24',
    background: 'rgba(251, 191, 36, 0.15)',
    border: '1px solid rgba(251, 191, 36, 0.35)',
    padding: '4px 16px',
    borderRadius: '20px',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    marginBottom: '8px'
  },
  title: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '2rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '2px',
    color: '#f1f5f9',
    margin: '0 0 6px 0'
  },
  resultBanner: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.6rem',
    fontWeight: 900,
    letterSpacing: '1.5px',
    textTransform: 'uppercase'
  },
  split: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    gap: '32px',
    alignItems: 'stretch',
    marginBottom: '24px'
  },
  teamCard: {
    background: 'rgba(17, 24, 39, 0.9)',
    border: '2px solid #1f2937',
    borderRadius: '18px',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  logoWrap: {
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    border: '3px solid #3b82f6',
    background: 'rgba(0,0,0,0.3)',
    marginBottom: '12px'
  },
  logoImg: {
    width: '75%',
    height: '75%',
    objectFit: 'contain'
  },
  teamName: {
    fontFamily: "'Rajdhani', sans-serif",
    fontSize: '1.8rem',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    textAlign: 'center',
    marginBottom: '8px'
  },
  scoreBig: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '5.5rem',
    fontWeight: 900,
    lineHeight: 1,
    margin: '8px 0 16px 0'
  },
  statsGrid: {
    width: '100%',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    marginBottom: '18px'
  },
  statBox: {
    background: 'rgba(8, 12, 20, 0.75)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '10px',
    padding: '10px',
    textAlign: 'center'
  },
  statLabel: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 600,
    marginBottom: '4px'
  },
  statValue: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '1.5rem',
    fontWeight: 700
  },
  timelineSection: {
    width: '100%',
    flex: 1,
    background: 'rgba(8, 12, 20, 0.65)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column'
  },
  timelineHeading: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  eventsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    maxHeight: '160px',
    overflowY: 'auto'
  },
  eventPill: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    borderRadius: '6px',
    background: 'rgba(255, 255, 255, 0.04)',
    borderLeft: '3px solid #22c55e',
    color: '#86efac',
    fontSize: '0.9rem',
    fontWeight: 600
  },
  eventTime: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem',
    color: '#fbbf24'
  },
  eventsEmpty: {
    fontSize: '0.85rem',
    color: '#94a3b8',
    fontStyle: 'italic',
    padding: '8px 0',
    textAlign: 'center'
  },
  centerDivider: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px'
  },
  vsCircle: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: '#1e293b',
    border: '2px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Orbitron', monospace",
    fontWeight: 900,
    fontSize: '1.2rem',
    color: '#fbbf24'
  },
  ftLabel: {
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.85rem',
    fontWeight: 700,
    color: '#94a3b8',
    letterSpacing: '2px'
  },
  footerActions: {
    display: 'flex',
    justifyContent: 'center',
    gap: '16px',
    marginTop: 'auto',
    paddingTop: '16px'
  },
  btnPrimary: {
    padding: '12px 28px',
    fontFamily: "'Orbitron', monospace",
    fontSize: '0.95rem',
    fontWeight: 700,
    letterSpacing: '1px',
    borderRadius: '8px',
    border: 'none',
    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
    color: '#000',
    cursor: 'pointer'
  },
  btnSecondary: {
    padding: '12px 24px',
    fontSize: '0.95rem',
    fontWeight: 600,
    borderRadius: '8px',
    border: '1px solid #30363d',
    background: 'transparent',
    color: '#e6edf3',
    cursor: 'pointer'
  }
};

