import React, { useState } from 'react';
import { useTeamContext } from '../context/TeamContext';

/**
 * Dashboard Component - Team Registration & Teams Pool
 * Matches dark/sports-themed UI of the scoreboard project.
 */
export default function Dashboard({ onNavigateToMatch }) {
  const { teams, addTeam, deleteTeam, loading } = useTeamContext();

  // Form State
  const [teamName, setTeamName] = useState('');
  const [student1, setStudent1] = useState({ name: '', grade: '', group: '', city: '' });
  const [student2, setStudent2] = useState({ name: '', grade: '', group: '', city: '' });
  const [logo, setLogo] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const presets = ['🤖', '⚡', '🦅', '🐉', '🔥', '🛡️', '🚀', '⚽'];

  // Handle Logo File Upload
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedPreset(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      setLogo(dataUrl);
      setLogoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Handle Preset Badge Selection
  const handleSelectPreset = (emoji) => {
    setSelectedPreset(emoji);
    setLogo(emoji);
    setLogoPreview(null);
  };

  const handleClearLogo = () => {
    setLogo(null);
    setLogoPreview(null);
    setSelectedPreset(null);
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) {
      alert('Please enter a team name');
      return;
    }
    if (!student1.name.trim() || !student2.name.trim()) {
      alert('Please enter both student names');
      return;
    }

    setSubmitting(true);
    try {
      await addTeam({
        teamName: teamName.trim(),
        name: teamName.trim(),
        logo: logo || selectedPreset || '🤖',
        student1,
        student2
      });

      // Reset form
      setTeamName('');
      setStudent1({ name: '', grade: '', group: '', city: '' });
      setStudent2({ name: '', grade: '', group: '', city: '' });
      handleClearLogo();

      setMessage(`✓ Team "${teamName}" registered successfully!`);
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to register team');
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered teams list
  const filteredTeams = teams.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (t.name || '').toLowerCase().includes(q) ||
      (t.student1?.name || '').toLowerCase().includes(q) ||
      (t.student2?.name || '').toLowerCase().includes(q) ||
      (t.student1?.city || '').toLowerCase().includes(q)
    );
  });

  return (
    <div style={styles.page}>
      {/* Top Navbar */}
      <header style={styles.navbar}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>🤖</span>
          <div>
            <h1 style={styles.brandTitle}>Robot Soccer Scoreboard</h1>
            <div style={styles.brandSub}>Team Registration Dashboard</div>
          </div>
        </div>
        <nav style={styles.navLinks}>
          <span style={{ ...styles.navLink, ...styles.navLinkActive }}>📋 Dashboard</span>
          <button
            onClick={() => (onNavigateToMatch ? onNavigateToMatch() : (window.location.href = '/match'))}
            style={{ ...styles.navLink, ...styles.navLinkAction }}
          >
            ⚔️ Matchmaker
          </button>
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

      {/* Main Form Card */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div>
            <h2 style={styles.cardTitle}>🏁 Register New Team</h2>
            <p style={styles.cardSubtitle}>
              Register student pairs, team identity, and upload or select an emblem.
            </p>
          </div>
          <button
            onClick={() => (onNavigateToMatch ? onNavigateToMatch() : (window.location.href = '/match'))}
            style={styles.btnSecondary}
          >
            Go to Matchmaker ➔
          </button>
        </div>

        {message && <div style={styles.alertSuccess}>{message}</div>}

        <form onSubmit={handleSubmit}>
          {/* Team Identity */}
          <div style={styles.formSection}>
            <div style={styles.badgeTeam}>🏷 Team Identity</div>
            <div style={styles.grid2}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Team Name <span style={styles.req}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., RoboStrikers, CyberKnights"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Team Crest / Logo</label>
                <div style={styles.logoPickerRow}>
                  <div style={styles.logoPreviewBox}>
                    {logoPreview ? (
                      <img src={logoPreview} alt="Logo" style={styles.logoImg} />
                    ) : selectedPreset ? (
                      <span style={{ fontSize: '2.5rem' }}>{selectedPreset}</span>
                    ) : (
                      <span style={{ fontSize: '2.2rem', opacity: 0.4 }}>🤖</span>
                    )}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      <label style={styles.uploadBtn}>
                        📁 Upload Image
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleLogoUpload}
                        />
                      </label>
                      {(logoPreview || selectedPreset) && (
                        <button type="button" onClick={handleClearLogo} style={styles.btnRemove}>
                          ✕ Clear
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#8b949e', marginBottom: '6px' }}>
                      Or choose an icon:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {presets.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => handleSelectPreset(p)}
                          style={{
                            ...styles.presetBtn,
                            borderColor: selectedPreset === p ? '#58a6ff' : '#30363d',
                            background: selectedPreset === p ? 'rgba(88,166,255,0.15)' : '#161b22'
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Student 1 Details */}
          <div style={styles.formSection}>
            <div style={styles.badgeStudent1}>👤 Student 1 Details</div>
            <div style={styles.grid4}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Student 1 Name <span style={styles.req}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={student1.name}
                  onChange={(e) => setStudent1({ ...student1, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Grade / Class</label>
                <input
                  type="text"
                  placeholder="e.g., Grade 8-A"
                  value={student1.grade}
                  onChange={(e) => setStudent1({ ...student1, grade: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Group</label>
                <input
                  type="text"
                  placeholder="e.g., Alpha Group"
                  value={student1.group}
                  onChange={(e) => setStudent1({ ...student1, group: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>City</label>
                <input
                  type="text"
                  placeholder="e.g., Dallas"
                  value={student1.city}
                  onChange={(e) => setStudent1({ ...student1, city: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Student 2 Details */}
          <div style={styles.formSection}>
            <div style={styles.badgeStudent2}>👤 Student 2 Details</div>
            <div style={styles.grid4}>
              <div style={styles.formGroup}>
                <label style={styles.label}>
                  Student 2 Name <span style={styles.req}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={student2.name}
                  onChange={(e) => setStudent2({ ...student2, name: e.target.value })}
                  style={styles.input}
                  required
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Grade / Class</label>
                <input
                  type="text"
                  placeholder="e.g., Grade 8-A"
                  value={student2.grade}
                  onChange={(e) => setStudent2({ ...student2, grade: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>Group</label>
                <input
                  type="text"
                  placeholder="e.g., Alpha Group"
                  value={student2.group}
                  onChange={(e) => setStudent2({ ...student2, group: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.label}>City</label>
                <input
                  type="text"
                  placeholder="e.g., Dallas"
                  value={student2.city}
                  onChange={(e) => setStudent2({ ...student2, city: e.target.value })}
                  style={styles.input}
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div style={styles.formActions}>
            <button type="submit" disabled={submitting} style={styles.btnPrimary}>
              {submitting ? 'Registering...' : '➕ Register Team'}
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Registered Teams Pool (Cards) */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={styles.cardTitle}>🏆 Registered Teams Pool</h2>
            <span style={styles.countBadge}>{teams.length} Teams</span>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search teams or students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>

        {/* Teams Grid */}
        <div style={styles.teamsGrid}>
          {filteredTeams.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{ fontSize: '3rem', opacity: 0.5, marginBottom: '8px' }}>🤖</div>
              <h3 style={{ color: '#e6edf3', marginBottom: '6px' }}>No teams registered yet</h3>
              <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>
                Use the form above to add teams (supports 10-15+ teams for tournament play).
              </p>
            </div>
          ) : (
            filteredTeams.map((team, idx) => (
              <div key={team.id || idx} style={styles.teamCard}>
                <div style={styles.teamCardHeader}>
                  <span style={styles.teamTag}>{team.teamNumber || `Team ${idx + 1}`}</span>
                  <button
                    onClick={() => deleteTeam(team.id)}
                    style={styles.deleteBtn}
                    title="Delete Team"
                  >
                    🗑
                  </button>
                </div>

                <div style={styles.teamIdentity}>
                  <div style={styles.cardLogo}>
                    {team.logo &&
                    (team.logo.startsWith('/') ||
                      team.logo.startsWith('http') ||
                      team.logo.startsWith('data:image')) ? (
                      <img src={team.logo} alt={team.name} style={styles.logoImg} />
                    ) : (
                      <span style={{ fontSize: '1.8rem' }}>{team.logo || '🤖'}</span>
                    )}
                  </div>
                  <div>
                    <h3 style={styles.teamNameText}>{team.name}</h3>
                    <div style={{ fontSize: '0.75rem', color: '#8b949e' }}>2 Members</div>
                  </div>
                </div>

                {/* Students Display */}
                <div style={styles.studentsContainer}>
                  <div style={styles.studentRow}>
                    <span style={styles.sBadge1}>S1</span>
                    <span style={styles.studentName}>{team.student1?.name || 'Student 1'}</span>
                    <span style={styles.studentPill}>{team.student1?.grade || ''}</span>
                    <span style={styles.studentPill}>{team.student1?.city || ''}</span>
                  </div>
                  <div style={styles.studentRow}>
                    <span style={styles.sBadge2}>S2</span>
                    <span style={styles.studentName}>{team.student2?.name || 'Student 2'}</span>
                    <span style={styles.studentPill}>{team.student2?.grade || ''}</span>
                    <span style={styles.studentPill}>{team.student2?.city || ''}</span>
                  </div>
                </div>

                {/* Card Action */}
                <button
                  onClick={() =>
                    onNavigateToMatch
                      ? onNavigateToMatch(team)
                      : (window.location.href = `/match?select=${team.id}`)
                  }
                  style={styles.cardSelectBtn}
                >
                  ⚔️ Select For Match
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Inline Styles matching dark/sports UI ───────────────────────────
const styles = {
  page: {
    backgroundColor: '#0d1117',
    color: '#e6edf3',
    minHeight: '100vh',
    padding: '16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
  },
  navbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#161b22',
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
  brandSub: { fontSize: '0.75rem', color: '#58a6ff', textTransform: 'uppercase', letterSpacing: '1.5px' },
  navLinks: { display: 'flex', gap: '8px', alignItems: 'center' },
  navLink: {
    padding: '6px 14px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    color: '#8b949e',
    background: 'transparent',
    textDecoration: 'none',
    fontSize: '0.85rem',
    cursor: 'pointer'
  },
  navLinkActive: { borderColor: '#58a6ff', color: '#58a6ff', background: 'rgba(88,166,255,0.1)' },
  navLinkAction: { borderColor: '#bc8cff', color: '#d2a8ff', background: 'rgba(188,140,255,0.15)' },
  card: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '12px',
    padding: '24px',
    marginBottom: '24px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '14px',
    borderBottom: '1px solid #30363d',
    flexWrap: 'wrap',
    gap: '12px'
  },
  cardTitle: { fontSize: '1.25rem', fontWeight: 700, margin: 0, textTransform: 'uppercase' },
  cardSubtitle: { fontSize: '0.85rem', color: '#8b949e', margin: '4px 0 0' },
  btnSecondary: {
    padding: '8px 16px',
    fontSize: '0.85rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: '1px solid #bc8cff',
    background: 'rgba(188,140,255,0.15)',
    color: '#d2a8ff',
    cursor: 'pointer'
  },
  alertSuccess: {
    backgroundColor: 'rgba(63,185,80,0.15)',
    border: '1px solid #3fb950',
    color: '#3fb950',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '0.9rem'
  },
  formSection: {
    backgroundColor: 'rgba(13,17,23,0.6)',
    border: '1px solid #30363d',
    borderRadius: '10px',
    padding: '16px',
    marginBottom: '18px'
  },
  badgeTeam: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#58a6ff',
    backgroundColor: 'rgba(88,166,255,0.15)',
    border: '1px solid rgba(88,166,255,0.3)',
    borderRadius: '12px',
    padding: '3px 10px',
    marginBottom: '12px'
  },
  badgeStudent1: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#3fb950',
    backgroundColor: 'rgba(63,185,80,0.15)',
    border: '1px solid rgba(63,185,80,0.3)',
    borderRadius: '12px',
    padding: '3px 10px',
    marginBottom: '12px'
  },
  badgeStudent2: {
    display: 'inline-block',
    fontSize: '0.75rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    color: '#e3b341',
    backgroundColor: 'rgba(227,179,65,0.15)',
    border: '1px solid rgba(227,179,65,0.3)',
    borderRadius: '12px',
    padding: '3px 10px',
    marginBottom: '12px'
  },
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '0.8rem', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase' },
  req: { color: '#f85149' },
  input: {
    padding: '10px 12px',
    fontSize: '0.95rem',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#e6edf3',
    outline: 'none'
  },
  logoPickerRow: {
    display: 'flex',
    gap: '14px',
    alignItems: 'center',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    padding: '10px'
  },
  logoPreviewBox: {
    width: '70px',
    height: '70px',
    borderRadius: '10px',
    border: '2px dashed #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  uploadBtn: {
    fontSize: '0.8rem',
    padding: '6px 12px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    backgroundColor: '#161b22',
    color: '#58a6ff',
    cursor: 'pointer'
  },
  btnRemove: {
    fontSize: '0.8rem',
    padding: '6px 10px',
    borderRadius: '6px',
    border: '1px solid rgba(248,81,73,0.3)',
    backgroundColor: 'transparent',
    color: '#f85149',
    cursor: 'pointer'
  },
  presetBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '6px',
    border: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', marginTop: '16px' },
  btnPrimary: {
    padding: '12px 28px',
    fontSize: '1rem',
    fontWeight: 700,
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#238636',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(35,134,54,0.4)'
  },
  countBadge: {
    fontSize: '0.75rem',
    padding: '3px 8px',
    borderRadius: '12px',
    backgroundColor: 'rgba(88,166,255,0.15)',
    color: '#58a6ff',
    border: '1px solid #58a6ff'
  },
  searchInput: {
    padding: '8px 12px',
    fontSize: '0.85rem',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '6px',
    color: '#e6edf3',
    width: '220px'
  },
  teamsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center',
    padding: '40px 20px',
    backgroundColor: '#0d1117',
    borderRadius: '10px',
    border: '1px dashed #30363d'
  },
  teamCard: {
    backgroundColor: '#161b22',
    border: '1px solid #30363d',
    borderRadius: '10px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between'
  },
  teamCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' },
  teamTag: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#e3b341',
    backgroundColor: 'rgba(227,179,65,0.12)',
    padding: '2px 8px',
    borderRadius: '4px'
  },
  deleteBtn: { background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '1rem' },
  teamIdentity: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  cardLogo: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  teamNameText: { margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#fff' },
  studentsContainer: {
    backgroundColor: '#0d1117',
    borderRadius: '6px',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px'
  },
  studentRow: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem' },
  sBadge1: { backgroundColor: 'rgba(63,185,80,0.2)', color: '#3fb950', padding: '1px 5px', borderRadius: '4px' },
  sBadge2: { backgroundColor: 'rgba(227,179,65,0.2)', color: '#e3b341', padding: '1px 5px', borderRadius: '4px' },
  studentName: { fontWeight: 600, color: '#e6edf3' },
  studentPill: { color: '#8b949e', fontSize: '0.75rem' },
  cardSelectBtn: {
    width: '100%',
    padding: '8px',
    fontSize: '0.85rem',
    fontWeight: 600,
    borderRadius: '6px',
    border: '1px solid rgba(88,166,255,0.3)',
    backgroundColor: 'rgba(88,166,255,0.1)',
    color: '#58a6ff',
    cursor: 'pointer'
  }
};

