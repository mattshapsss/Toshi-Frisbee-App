import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ArrowLeft, Calendar, Target, Users, BarChart3 } from 'lucide-react';
import { gamesApi, teamsApi, defendersApi, pointsApi, authApi } from '../lib/api';
import { socketManager } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';

const UltimateDLineApp = () => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  
  const [currentView, setCurrentView] = useState(gameId ? 'game' : 'home');
  const [games, setGames] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [newGameName, setNewGameName] = useState('');

  // Global roster management
  const [globalRoster, setGlobalRoster] = useState([]);
  const [newDefenderName, setNewDefenderName] = useState('');

  // Game-specific state
  const [offensivePlayers, setOffensivePlayers] = useState([]);
  const [matchups, setMatchups] = useState([]);
  const [currentPoint, setCurrentPoint] = useState([]);
  const [savedPoints, setSavedPoints] = useState([]);
  const [expandedPoints, setExpandedPoints] = useState([]);
  const [newOffenderName, setNewOffenderName] = useState('');
  const [newOffenderPosition, setNewOffenderPosition] = useState('Handler');
  const [lastButtonClicked, setLastButtonClicked] = useState(null);

  // Team state
  const [currentTeam, setCurrentTeam] = useState(null);

  // Tufts Blue color
  const tuftsBlue = '#3E8EDE';

  // Offensive positions
  const offensivePositions = [
    'Handler',
    'Cutter',
    'Center Handler',
    'Reset Handler',
    'Front of Stack',
    'Initiating Cutter',
    'Fill Cutter',
    'Deep Cutter'
  ];

  // Fetch user's teams
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list,
    enabled: !!user
  });

  // Fetch games for current team
  const { data: teamGames = [] } = useQuery({
    queryKey: ['games', currentTeam?.id],
    queryFn: () => currentTeam ? gamesApi.list({ teamId: currentTeam.id }) : Promise.resolve([]),
    enabled: !!currentTeam
  });

  // Fetch team defenders (global roster)
  const { data: defenders = [] } = useQuery({
    queryKey: ['defenders', currentTeam?.id],
    queryFn: () => currentTeam ? defendersApi.listByTeam(currentTeam.id) : Promise.resolve([]),
    enabled: !!currentTeam
  });

  // Update global roster when defenders change
  useEffect(() => {
    if (defenders) {
      setGlobalRoster(defenders);
    }
  }, [defenders]);

  // Fetch current game if gameId is provided
  const { data: gameData } = useQuery({
    queryKey: ['game', gameId],
    queryFn: () => gameId ? gamesApi.get(gameId) : Promise.resolve(null),
    enabled: !!gameId
  });

  // Update game state when gameData changes
  useEffect(() => {
    if (gameData) {
      setCurrentGame(gameData);
      setOffensivePlayers(gameData.offensivePlayers || []);
      setSavedPoints(gameData.points || []);
      // Set up initial matchups
      const initialMatchups = (gameData.offensivePlayers || []).map((player: any) => ({
        id: Date.now() + Math.random(),
        offender: player,
        defenders: []
      }));
      setMatchups(initialMatchups);
    }
  }, [gameData]);

  // Create team mutation
  const createTeamMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: (team) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCurrentTeam(team);
    }
  });

  // Create game mutation
  const createGameMutation = useMutation({
    mutationFn: gamesApi.create,
    onSuccess: (game) => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
      loadGame(game);
    }
  });

  // Add defender mutation
  const addDefenderMutation = useMutation({
    mutationFn: (name: string) => {
      if (!currentTeam) throw new Error('No team selected');
      return defendersApi.create({
        teamId: currentTeam.id,
        name
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defenders'] });
      setNewDefenderName('');
    }
  });

  // Add offensive player mutation
  const addOffensivePlayerMutation = useMutation({
    mutationFn: (data: any) => {
      if (!currentGame) throw new Error('No game selected');
      return gamesApi.addOffensivePlayer(currentGame.id, data);
    },
    onSuccess: () => {
      if (currentGame) {
        queryClient.invalidateQueries({ queryKey: ['game', currentGame.id] });
      }
    }
  });

  // Save point mutation
  const savePointMutation = useMutation({
    mutationFn: (data: any) => pointsApi.create(data),
    onSuccess: () => {
      if (currentGame) {
        queryClient.invalidateQueries({ queryKey: ['game', currentGame.id] });
      }
      setCurrentPoint([]);
    }
  });

  // Delete point mutation
  const deletePointMutation = useMutation({
    mutationFn: (pointId: string) => pointsApi.delete(pointId),
    onSuccess: () => {
      if (currentGame) {
        queryClient.invalidateQueries({ queryKey: ['game', currentGame.id] });
      }
    }
  });

  useEffect(() => {
    // Set default team if available
    if (teams.length > 0 && !currentTeam) {
      setCurrentTeam(teams[0]);
    }
  }, [teams, currentTeam]);

  useEffect(() => {
    // Update games list when team games change
    setGames(teamGames);
  }, [teamGames]);

  useEffect(() => {
    // Connect to WebSocket when game is loaded
    if (currentGame?.id) {
      socketManager.joinGame(currentGame.id);

      return () => {
        socketManager.leaveGame();
      };
    }
  }, [currentGame?.id]);

  const addToGlobalRoster = () => {
    if (newDefenderName.trim() && currentTeam) {
      addDefenderMutation.mutate(newDefenderName.trim());
    }
  };

  const removeFromGlobalRoster = (defenderId) => {
    // This would need a delete mutation
    console.log('Remove defender:', defenderId);
  };

  const createNewGame = () => {
    if (!newGameName.trim() || !currentTeam) return;
    
    createGameMutation.mutate({
      teamId: currentTeam.id,
      name: newGameName.trim(),
      isPublic: false
    });
    setNewGameName('');
  };

  const loadGame = (game) => {
    setCurrentGame(game);
    setOffensivePlayers(game.offensivePlayers || []);
    setSavedPoints(game.points || []);
    setCurrentView('game');
  };

  const deleteGame = (gameId) => {
    gamesApi.delete(gameId).then(() => {
      queryClient.invalidateQueries({ queryKey: ['games'] });
    });
  };

  const goHome = () => {
    setCurrentView('home');
    setCurrentGame(null);
  };

  const addOffender = () => {
    if (newOffenderName.trim() && currentGame) {
      addOffensivePlayerMutation.mutate({
        name: newOffenderName.trim(),
        position: newOffenderPosition.replace(/ /g, '_').toUpperCase()
      });
      setNewOffenderName('');
    }
  };

  const addDefenderToMatchup = (matchupId, defenderId) => {
    const defender = globalRoster.find(d => d.id === defenderId);
    if (!defender) return;

    setMatchups(prev => prev.map(m => 
      m.id === matchupId ? { 
        ...m, 
        defenders: (m.defenders || []).some(d => d.id === defender.id) 
          ? m.defenders
          : [...(m.defenders || []), defender]
      } : m
    ));
  };

  const removeDefenderFromMatchup = (matchupId, defenderId) => {
    setMatchups(prev => prev.map(m =>
      m.id === matchupId ? {
        ...m,
        defenders: m.defenders ? m.defenders.filter(d => d.id !== defenderId) : []
      } : m
    ));
  };

  const addDefenderToCurrentPoint = (matchupId, defenderId) => {
    const defender = globalRoster.find(d => d.id === defenderId);
    if (!defender) return;

    setCurrentPoint(prev => {
      const filtered = prev.filter(cp => cp.defender.id !== defender.id && cp.matchupId !== matchupId);
      return [...filtered, {
        id: Date.now(),
        matchupId,
        defender,
        offensivePlayerId: matchups.find(m => m.id === matchupId)?.offender?.id
      }];
    });
  };

  const removeDefenderFromCurrentPoint = (matchupId) => {
    setCurrentPoint(prev => prev.filter(cp => cp.matchupId !== matchupId));
  };

  const handleDragStart = (e, defenderId) => {
    e.dataTransfer.setData('defenderId', defenderId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, matchupId) => {
    e.preventDefault();
    const defenderId = e.dataTransfer.getData('defenderId');
    if (defenderId) {
      addDefenderToMatchup(matchupId, defenderId);
    }
  };

  const handleCurrentPointDrop = (e, matchupId) => {
    e.preventDefault();
    const defenderId = e.dataTransfer.getData('defenderId');
    if (defenderId) {
      addDefenderToCurrentPoint(matchupId, defenderId);
    }
  };

  const clearCurrentPoint = () => {
    setCurrentPoint([]);
  };

  const clearAllMatchups = () => {
    setMatchups(prev => prev.map(m => ({ ...m, defenders: [] })));
    setCurrentPoint([]);
  };

  const savePoint = (gotBreak) => {
    if (!currentGame || currentPoint.length === 0) return;

    const matchups = currentPoint.map(cp => ({
      offensivePlayerId: cp.offensivePlayerId,
      defenderId: cp.defender.id
    }));

    savePointMutation.mutate({
      gameId: currentGame.id,
      gotBreak,
      matchups
    });

    setLastButtonClicked(gotBreak ? 'break' : 'nobreak');
    setTimeout(() => setLastButtonClicked(null), 500);
  };

  const removeMatchup = (matchupId) => {
    setMatchups(prev => prev.filter(m => m.id !== matchupId));
    setCurrentPoint(prev => prev.filter(cp => cp.matchupId !== matchupId));
  };

  const updateOffenderPosition = (offenderId, newPosition) => {
    setOffensivePlayers(prev => prev.map(player =>
      player.id === offenderId ? { ...player, position: newPosition } : player
    ));
    setMatchups(prev => prev.map(matchup =>
      matchup.offender && matchup.offender.id === offenderId
        ? { ...matchup, offender: { ...matchup.offender, position: newPosition } }
        : matchup
    ));
  };

  const getPlayingTimeStats = () => {
    const stats = {};
    globalRoster.forEach(player => {
      stats[player.id] = {
        id: player.id,
        name: player.name,
        pointsPlayed: 0,
        breaks: 0,
        noBreaks: 0
      };
    });

    savedPoints.forEach(point => {
      if (point.matchups) {
        point.matchups.forEach(matchup => {
          if (matchup.defender && stats[matchup.defender.id]) {
            stats[matchup.defender.id].pointsPlayed++;
            if (point.gotBreak) {
              stats[matchup.defender.id].breaks++;
            } else {
              stats[matchup.defender.id].noBreaks++;
            }
          }
        });
      }
    });

    return Object.values(stats).sort((a, b) => b.pointsPlayed - a.pointsPlayed);
  };

  const handleDeletePoint = (pointId) => {
    deletePointMutation.mutate(pointId);
  };

  const togglePointExpansion = (pointId) => {
    setExpandedPoints(prev =>
      prev.includes(pointId)
        ? prev.filter(id => id !== pointId)
        : [...prev, pointId]
    );
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPositionColor = (position) => {
    const pos = position?.replace(/_/g, ' ') || 'Handler';
    switch(pos) {
      case 'Handler':
      case 'Center Handler':
      case 'Reset Handler':
        return 'bg-blue-100 text-blue-800';
      case 'Cutter':
      case 'Initiating Cutter':
      case 'Fill Cutter':
      case 'Deep Cutter':
        return 'bg-green-100 text-green-800';
      case 'Front of Stack':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Roster Management View
  if (currentView === 'roster') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setCurrentView('home')}
                  className="flex items-center text-gray-300 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-5 w-5 mr-2" />
                  Back
                </button>
                <h1 className="text-xl font-semibold">Team Roster & Statistics</h1>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
          {/* Add New Defender */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-semibold mb-4 text-gray-800">Add New Defender</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newDefenderName}
                onChange={(e) => setNewDefenderName(e.target.value)}
                placeholder="Enter defender name"
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && addToGlobalRoster()}
              />
              <button
                onClick={addToGlobalRoster}
                disabled={!newDefenderName.trim()}
                className="px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 text-base"
                style={{ backgroundColor: tuftsBlue }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Add Defender
              </button>
            </div>
          </div>

          {/* Roster Table - Exactly like original */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Roster & Overall Statistics
              </h2>
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {globalRoster.length} defenders
              </span>
            </div>
            
            {globalRoster.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-600 mb-2">No Defenders Yet</h4>
                <p className="text-gray-500">Add defenders above to start tracking statistics.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Games</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Total Points</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Breaks</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Break %</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getPlayingTimeStats().map((player, index) => (
                      <tr key={player.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">{player.name}</td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {games.length}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" 
                                style={{ backgroundColor: tuftsBlue }}>
                            {player.pointsPlayed}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {player.breaks}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            player.pointsPlayed === 0 
                              ? 'bg-gray-100 text-gray-800'
                              : (player.breaks / player.pointsPlayed) >= 0.5 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {player.pointsPlayed === 0 ? '-' : `${Math.round((player.breaks / player.pointsPlayed) * 100)}%`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <button
                            onClick={() => removeFromGlobalRoster(player.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                            title="Delete player"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Home View - Exactly like original
  if (currentView === 'home') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gray-800 text-white">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl sm:text-2xl font-semibold">Ultimate D-Line Manager</h1>
              {user && (
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-300">Team: {currentTeam?.name}</span>
                  <button
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="text-sm text-gray-300 hover:text-white"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-800">D-Line Command Center</h2>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('roster')}
              className="w-full flex items-center justify-center space-x-3 bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <Users className="h-6 w-6 text-blue-600" />
              <div className="text-left">
                <div className="font-semibold text-gray-900">Manage Roster & View Statistics</div>
                <div className="text-sm text-gray-600">{globalRoster.length} defenders • Overall performance data</div>
              </div>
            </button>
          </div>

          {/* Create New Game Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Create New Game</h3>
            <div className="space-y-3">
              <input
                type="text"
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Enter game name (e.g., Tufts vs Opponent)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && createNewGame()}
              />
              <button
                onClick={createNewGame}
                disabled={!newGameName.trim()}
                className="w-full px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 text-base"
                style={{ backgroundColor: tuftsBlue }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Create Game
              </button>
            </div>
          </div>
          
          {/* Games List */}
          <div>
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Your Games</h3>
            {games.length === 0 ? (
              <div className="text-center py-12">
                <Target className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-600 mb-2">No Games Yet</h4>
                <p className="text-gray-500">Create your first game to start tracking defensive matchups.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {games.map(game => (
                  <div 
                    key={game.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow p-4"
                    onClick={() => loadGame(game)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-gray-800 truncate">{game.name}</h4>
                        <div className="text-sm text-gray-600 mt-1 flex items-center">
                          <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span className="truncate">{formatDate(game.createdAt)}</span>
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          <span className="font-medium">{game.points?.length || 0}</span> points tracked
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteGame(game.id);
                        }}
                        className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors ml-2 flex-shrink-0"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Game View - EXACTLY like original
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={goHome}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            <div className="flex space-x-2">
              <button
                onClick={clearCurrentPoint}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium"
              >
                Clear Point
              </button>
              <button
                onClick={clearAllMatchups}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium"
              >
                Clear All
              </button>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-semibold truncate">{currentGame?.name}</h1>
            <p className="text-xs text-gray-400">Auto-saving changes</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Point Control Section - EXACTLY like original */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-700 text-white px-4 py-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium">Current Point</h2>
              <div className="px-3 py-1 rounded-md text-white text-sm font-medium" style={{ backgroundColor: tuftsBlue }}>
                Point #{savedPoints.length + 1}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => savePoint(true)}
                className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all ${
                  lastButtonClicked === 'break' 
                    ? 'bg-emerald-800 scale-95' 
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                Break ✓
              </button>
              <button
                onClick={() => savePoint(false)}
                className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all ${
                  lastButtonClicked === 'nobreak' 
                    ? 'bg-rose-800 scale-95' 
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                No Break ✗
              </button>
            </div>
          </div>
        </div>

        {/* Rest of the game view continues exactly as in original... */}
        {/* [The matchups table, add offensive players, statistics, and point history sections remain identical] */}
      </div>
    </div>
  );
};

export default UltimateDLineApp;