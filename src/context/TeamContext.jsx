import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Team Context providing state management for teams and match-making setup.
 */
const TeamContext = createContext(null);

export function TeamProvider({ children }) {
  const [teams, setTeams] = useState([]);
  const [selectedTeamA, setSelectedTeamA] = useState(null);
  const [selectedTeamB, setSelectedTeamB] = useState(null);
  const [matchDuration, setMatchDuration] = useState(600); // 10 minutes in seconds
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load initial teams from server or localStorage
  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teams');
      if (res.ok) {
        const data = await res.json();
        setTeams(data);
      } else {
        // Fallback to local storage if API is unreachable
        const cached = localStorage.getItem('robot_soccer_teams');
        if (cached) setTeams(JSON.parse(cached));
      }
    } catch (err) {
      console.warn('API error, using localStorage fallback', err);
      const cached = localStorage.getItem('robot_soccer_teams');
      if (cached) setTeams(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  // Add a new team
  const addTeam = async (teamData) => {
    try {
      setLoading(true);
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(teamData)
      });

      if (res.ok) {
        const result = await res.json();
        setTeams(result.teams || [...teams, result.team]);
        localStorage.setItem('robot_soccer_teams', JSON.stringify(result.teams || [...teams, result.team]));
        return result.team;
      } else {
        throw new Error('Failed to register team on server');
      }
    } catch (err) {
      // Local fallback
      const newTeam = {
        id: `team-${Date.now()}`,
        teamNumber: `Team ${teams.length + 1}`,
        teamName: teamData.teamName || teamData.name,
        name: teamData.teamName || teamData.name,
        logo: teamData.logo || null,
        student1: teamData.student1,
        student2: teamData.student2,
        createdAt: new Date().toISOString()
      };
      const updated = [...teams, newTeam];
      setTeams(updated);
      localStorage.setItem('robot_soccer_teams', JSON.stringify(updated));
      return newTeam;
    } finally {
      setLoading(false);
    }
  };

  // Delete a team
  const deleteTeam = async (teamId) => {
    try {
      await fetch(`/api/teams/${teamId}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('Delete server error', err);
    }
    const updated = teams.filter(t => t.id !== teamId);
    setTeams(updated);
    localStorage.setItem('robot_soccer_teams', JSON.stringify(updated));

    if (selectedTeamA?.id === teamId) setSelectedTeamA(null);
    if (selectedTeamB?.id === teamId) setSelectedTeamB(null);
  };

  // Select team for match slot
  const selectTeam = (team) => {
    if (!selectedTeamA) {
      setSelectedTeamA(team);
    } else if (!selectedTeamB) {
      if (selectedTeamA.id === team.id) return;
      setSelectedTeamB(team);
    } else {
      // If both filled, overwrite Slot A
      setSelectedTeamA(team);
    }
  };

  // Deselect / Remove team from slot
  const removeSelectedTeam = (slot) => {
    if (slot === 'a') setSelectedTeamA(null);
    if (slot === 'b') setSelectedTeamB(null);
  };

  // Swap corners
  const swapTeams = () => {
    const temp = selectedTeamA;
    setSelectedTeamA(selectedTeamB);
    setSelectedTeamB(temp);
  };

  // Start match
  const startMatch = async (navigateCallback) => {
    if (!selectedTeamA || !selectedTeamB) {
      throw new Error('Please select both competing teams.');
    }

    const nameA = selectedTeamA.teamName || selectedTeamA.name || 'Team 1';
    const nameB = selectedTeamB.teamName || selectedTeamB.name || 'Team 2';

    const payload = {
      teamA: {
        id: selectedTeamA.id,
        teamId: selectedTeamA.id,
        teamName: nameA,
        name: nameA,
        logo: selectedTeamA.logo
      },
      teamB: {
        id: selectedTeamB.id,
        teamId: selectedTeamB.id,
        teamName: nameB,
        name: nameB,
        logo: selectedTeamB.logo
      },
      duration: matchDuration
    };

    const res = await fetch('/api/match/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start match');
    }

    const data = await res.json();
    if (navigateCallback) {
      navigateCallback(data.redirect || '/control');
    } else {
      window.location.href = data.redirect || '/control';
    }
  };

  // Record Goal
  const recordGoal = async (team) => {
    try {
      await fetch('/api/match/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'goal', team })
      });
    } catch (e) {
      console.warn('Record goal error:', e);
    }
  };

  // Record Penalty
  const recordPenalty = async (team, delta = 1) => {
    try {
      await fetch('/api/match/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'penalty', team, delta })
      });
    } catch (e) {
      console.warn('Record penalty error:', e);
    }
  };

  // End Match
  const endMatch = async () => {
    try {
      const res = await fetch('/api/match/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      return await res.json();
    } catch (e) {
      console.warn('End match error:', e);
    }
  };

  // Fetch Leaderboard / Points Table
  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      if (res.ok) return await res.json();
    } catch (e) {
      console.warn('Error fetching leaderboard:', e);
    }
    return [];
  };

  const value = {
    teams,
    selectedTeamA,
    selectedTeamB,
    matchDuration,
    setMatchDuration,
    loading,
    error,
    addTeam,
    deleteTeam,
    selectTeam,
    removeSelectedTeam,
    swapTeams,
    startMatch,
    recordGoal,
    recordPenalty,
    endMatch,
    fetchLeaderboard,
    refetchTeams: fetchTeams
  };

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeamContext() {
  const context = useContext(TeamContext);
  if (!context) {
    throw new Error('useTeamContext must be used within a TeamProvider');
  }
  return context;
}

