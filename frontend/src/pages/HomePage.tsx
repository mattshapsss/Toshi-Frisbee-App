import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Target, Calendar, LogOut, BarChart3, UserPlus, PlayCircle, CheckCircle, Archive, Clock } from 'lucide-react';
import { gamesApi, teamsApi, authApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import ProfileDropdown from '../components/ProfileDropdown';

export default function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { currentTeam, setCurrentTeam, teams: storedTeams, setTeams } = useTeamStore();
  const [newGameName, setNewGameName] = useState('');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [gameFilter, setGameFilter] = useState<'all' | 'active' | 'completed'>('active');

  // Fetch user's teams
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list
  });

  // Update teams in store when they change
  useEffect(() => {
    if (teams.length > 0) {
      setTeams(teams);
      // Auto-select first team if no current team
      if (!currentTeam && teams.length > 0) {
        setCurrentTeam(teams[0]);
      }
    }
  }, [teams]); // Don't include currentTeam to avoid loops

  // Fetch games for current team
  const { data: games = [] } = useQuery({
    queryKey: ['games', currentTeam?.id],
    queryFn: () => currentTeam ? gamesApi.list({ teamId: currentTeam.id }) : Promise.resolve([]),
    enabled: !!currentTeam
  });

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateTeam(false);
      setNewTeamName('');
      // Set the new team as current and redirect to home
      const teamWithRole = { ...newTeam, role: 'OWNER' };
      setCurrentTeam(teamWithRole);
      navigate('/');
    }
  });

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: gamesApi.create,
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      navigate(`/game/${game.id}`);
    }
  });

  const handleCreateGame = () => {
    if (!newGameName.trim() || !currentTeam) return;
    
    // Get game defaults from settings
    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
    const isPublic = settings?.gameDefaults?.defaultPublic || false;
    
    createGameMutation.mutate({
      teamId: currentTeam.id,
      name: newGameName.trim(),
      isPublic
    });
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    createTeamMutation.mutate({ name: newTeamName.trim() });
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold">Ultimate D-Line Manager</h1>
              {currentTeam && (
                <p className="text-xs text-gray-400 mt-1">Team: {currentTeam.name}</p>
              )}
            </div>
            <ProfileDropdown />
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">D-Line Command Center</h2>
        </div>

        {/* Roster & Statistics Button */}
        {currentTeam && (
          <div className="mb-6">
            <button
              onClick={() => navigate(`/teams/${currentTeam.id}/roster`)}
              className="w-full flex items-center justify-center space-x-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <BarChart3 className="h-6 w-6 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">{currentTeam.name} Roster and Statistics</div>
                <div className="text-sm text-gray-600">View team stats and manage defenders</div>
              </div>
            </button>
          </div>
        )}

        {/* Team Selection */}
        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Welcome! Let's Get Started</h3>
            <p className="text-gray-600 mb-4">You need to join or create a team to start tracking games.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/teams')}
                className="flex flex-col items-center justify-center p-6 bg-green-50 border-2 border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <UserPlus className="h-10 w-10 text-green-600 mb-2" />
                <span className="font-semibold text-gray-900">Join Existing Team</span>
                <span className="text-sm text-gray-600 mt-1">Have an invite code?</span>
              </button>
              <button
                onClick={() => navigate('/teams')}
                className="flex flex-col items-center justify-center p-6 bg-blue-50 border-2 border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-10 w-10 text-blue-600 mb-2" />
                <span className="font-semibold text-gray-900">Create New Team</span>
                <span className="text-sm text-gray-600 mt-1">Start your own team</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Create New Game */}
        {currentTeam && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Create New Game</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Enter game name (e.g., Tufts vs Opponent)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && handleCreateGame()}
              />
              <button
                onClick={handleCreateGame}
                disabled={!newGameName.trim() || createGameMutation.isPending}
                className="w-full px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 text-base"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Create Game
              </button>
            </div>
          </div>
        )}
        
        {/* Games List */}
        {currentTeam && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Your Games</h3>
              <div className="flex space-x-2">
                <button
                  onClick={() => setGameFilter('active')}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    gameFilter === 'active' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() => setGameFilter('completed')}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    gameFilter === 'completed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Completed
                </button>
                <button
                  onClick={() => setGameFilter('all')}
                  className={`px-3 py-1 rounded text-sm font-medium ${
                    gameFilter === 'all'
                      ? 'bg-gray-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
              </div>
            </div>
            {games.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-600 mb-2">No Games Yet</h4>
                <p className="text-gray-500">Create your first game to start tracking defensive matchups.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {games
                  .filter((game: any) => {
                    if (gameFilter === 'active') return game.status === 'SETUP' || game.status === 'IN_PROGRESS';
                    if (gameFilter === 'completed') return game.status === 'COMPLETED';
                    return true;
                  })
                  .map((game: any) => (
                  <div 
                    key={game.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4 cursor-pointer"
                    onClick={() => navigate(`/game/${game.id}`)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-base font-semibold text-gray-800 truncate">{game.name}</h4>
                          {game.status === 'COMPLETED' && (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                          )}
                          {game.status === 'IN_PROGRESS' && (
                            <PlayCircle className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                          {game.status === 'SETUP' && (
                            <Clock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                          )}
                          {game.isPublic && (
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Public</span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 mt-1 flex items-center">
                          <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{formatDate(game.createdAt)}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="font-medium">{game._count?.points || 0}</span> points tracked
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}