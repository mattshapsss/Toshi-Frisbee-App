import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { useTeamStore } from './stores/teamStore';
import { socketManager } from './lib/socket';
import { teamsApi } from './lib/api';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import TeamsPage from './pages/TeamsPage';
import GamePage from './pages/GamePage';
import RosterPage from './pages/RosterPage';
import ProfilePage from './pages/ProfilePage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { isAuthenticated, user } = useAuthStore();
  const { setCurrentTeam, setTeams, currentTeam } = useTeamStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load teams and restore selected team
    const loadTeams = async () => {
      if (isAuthenticated && user) {
        try {
          const teams = await teamsApi.list();
          setTeams(teams);
          
          // Validate that current team still exists for this user
          if (currentTeam) {
            const teamStillExists = teams.some(t => t.id === currentTeam.id);
            if (!teamStillExists) {
              // Clear invalid cached team
              setCurrentTeam(null);
            }
          }
          
          // If no current team but teams exist, select the first one
          if (!currentTeam && teams.length > 0) {
            setCurrentTeam(teams[0]);
          }
        } catch (error) {
          console.error('Failed to load teams:', error);
          // Clear team data on error
          setCurrentTeam(null);
          setTeams([]);
        }
      } else {
        // Clear team data when not authenticated
        setCurrentTeam(null);
        setTeams([]);
      }
      setLoading(false);
    };

    loadTeams();
  }, [isAuthenticated, user]); // Remove currentTeam from deps to avoid infinite loop

  // Manage socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      socketManager.connect();
      return () => {
        socketManager.disconnect();
      };
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/" />} />
      <Route path="/register" element={!isAuthenticated ? <RegisterPage /> : <Navigate to="/" />} />
      <Route path="/public/game/:shareCode" element={<GamePage isPublic={true} />} />
      
      {/* Protected routes */}
      {isAuthenticated ? (
        <>
          <Route path="/" element={<HomePage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId/roster" element={<RosterPage />} />
          <Route path="/game/:gameId" element={<GamePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
}

export default App;