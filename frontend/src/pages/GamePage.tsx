import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ArrowLeft, Users, BarChart3, Download, Clock, Save, Share2, CheckCircle, PlayCircle } from 'lucide-react';
import { gamesApi, defendersApi, pointsApi } from '../lib/api';
import { socketManager } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';

interface GamePageProps {
  isPublic?: boolean;
}

export default function GamePage({ isPublic = false }: GamePageProps) {
  const { gameId, shareCode } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuthStore();
  
  const [currentPoint, setCurrentPoint] = useState<any[]>([]);
  const [expandedPoints, setExpandedPoints] = useState<string[]>([]);
  const [newOffenderName, setNewOffenderName] = useState('');
  const [newOffenderPosition, setNewOffenderPosition] = useState('HANDLER');
  const [lastButtonClicked, setLastButtonClicked] = useState<string | null>(null);
  const [draggedDefender, setDraggedDefender] = useState<any | null>(null);
  const [dragOverPlayer, setDragOverPlayer] = useState<string | null>(null);
  const [pointStartTime, setPointStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [unsavedChanges, setUnsavedChanges] = useState(false);

  // Offensive positions
  const offensivePositions = [
    'HANDLER',
    'CUTTER',
    'CENTER_HANDLER',
    'RESET_HANDLER',
    'FRONT_OF_STACK',
    'INITIATING_CUTTER',
    'FILL_CUTTER',
    'DEEP_CUTTER'
  ];

  // Fetch game data
  const { data: game, isLoading } = useQuery({
    queryKey: ['game', gameId || shareCode],
    queryFn: async () => {
      if (isPublic && shareCode) {
        return gamesApi.getPublic(shareCode);
      }
      return gamesApi.get(gameId!);
    },
    enabled: !!(gameId || shareCode)
  });

  // Fetch team defenders
  const { data: defenders = [] } = useQuery({
    queryKey: ['defenders', game?.teamId],
    queryFn: () => defendersApi.listByTeam(game.teamId),
    enabled: !!game?.teamId && !isPublic
  });

  // Add offensive player mutation
  const addOffensivePlayerMutation = useMutation({
    mutationFn: (data: any) => gamesApi.addOffensivePlayer(game.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
      setNewOffenderName('');
    }
  });

  // Update offensive player mutation
  const updateOffensivePlayerMutation = useMutation({
    mutationFn: ({ playerId, data }: any) => 
      gamesApi.updateOffensivePlayer(game.id, playerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
    }
  });

  // Delete offensive player mutation
  const deleteOffensivePlayerMutation = useMutation({
    mutationFn: (playerId: string) => 
      gamesApi.deleteOffensivePlayer(game.id, playerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
    }
  });

  // Create point mutation
  const createPointMutation = useMutation({
    mutationFn: (data: any) => pointsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
      setCurrentPoint([]);
      setUnsavedChanges(false);
      setPointStartTime(null);
      setElapsedTime(0);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    }
  });

  // Delete point mutation
  const deletePointMutation = useMutation({
    mutationFn: (pointId: string) => pointsApi.delete(pointId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
    }
  });

  // Update game status mutation
  const updateGameStatusMutation = useMutation({
    mutationFn: (status: string) => gamesApi.update(game?.id || '', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['game'] });
      alert('Game marked as complete!');
    }
  });

  // Timer for elapsed time on current point
  useEffect(() => {
    if (pointStartTime) {
      const interval = setInterval(() => {
        setElapsedTime(Math.floor((new Date().getTime() - pointStartTime.getTime()) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [pointStartTime]);

  // Auto-complete game after 3 hours
  useEffect(() => {
    if (game && game.status === 'IN_PROGRESS') {
      const gameStartTime = new Date(game.updatedAt || game.createdAt);
      const now = new Date();
      const hoursElapsed = (now.getTime() - gameStartTime.getTime()) / (1000 * 60 * 60);
      
      if (hoursElapsed >= 3) {
        // Auto-complete the game
        updateGameStatusMutation.mutate('COMPLETED');
      } else {
        // Set timer for remaining time
        const remainingMs = (3 * 60 * 60 * 1000) - (now.getTime() - gameStartTime.getTime());
        const timer = setTimeout(() => {
          updateGameStatusMutation.mutate('COMPLETED');
        }, remainingMs);
        
        return () => clearTimeout(timer);
      }
    }
  }, [game?.id, game?.status]);

  // WebSocket setup
  useEffect(() => {
    if (game?.id && isAuthenticated) {
      socketManager.joinGame(game.id);

      const handlePointUpdate = (data: any) => {
        queryClient.invalidateQueries({ queryKey: ['game'] });
      };

      const handleMatchupUpdate = (data: any) => {
        queryClient.invalidateQueries({ queryKey: ['game'] });
      };

      socketManager.on('point-updated', handlePointUpdate);
      socketManager.on('matchup-updated', handleMatchupUpdate);

      return () => {
        socketManager.off('point-updated', handlePointUpdate);
        socketManager.off('matchup-updated', handleMatchupUpdate);
        socketManager.leaveGame();
      };
    }
  }, [game?.id, isAuthenticated]);

  const addOffender = () => {
    if (newOffenderName.trim() && game) {
      addOffensivePlayerMutation.mutate({
        name: newOffenderName.trim(),
        position: newOffenderPosition,
        isBench: game.offensivePlayers?.length >= 7
      });
    }
  };

  const addDefenderToCurrentPoint = (offensivePlayerId: string, defenderId: string) => {
    setCurrentPoint(prev => {
      const filtered = prev.filter(cp => cp.offensivePlayerId !== offensivePlayerId);
      return [...filtered, { offensivePlayerId, defenderId }];
    });

    if (socketManager.isConnected() && game) {
      socketManager.updatePoint({
        gameId: game.id,
        gotBreak: false,
        matchups: currentPoint
      });
    }
  };

  const removeDefenderFromCurrentPoint = (offensivePlayerId: string) => {
    setCurrentPoint(prev => prev.filter(cp => cp.offensivePlayerId !== offensivePlayerId));
  };

  const clearCurrentPoint = () => {
    setCurrentPoint([]);
  };

  const savePoint = (gotBreak: boolean) => {
    if (!game || currentPoint.length === 0) return;

    // Update game status to IN_PROGRESS if it's still in SETUP
    if (game.status === 'SETUP') {
      gamesApi.update(game.id, { status: 'IN_PROGRESS' });
    }

    const matchups = currentPoint.map(cp => ({
      offensivePlayerId: cp.offensivePlayerId,
      defenderId: cp.defenderId
    }));

    createPointMutation.mutate({
      gameId: game.id,
      gotBreak,
      matchups
    });

    setLastButtonClicked(gotBreak ? 'break' : 'nobreak');
    setTimeout(() => setLastButtonClicked(null), 500);
  };

  const togglePointExpansion = (pointId: string) => {
    setExpandedPoints(prev =>
      prev.includes(pointId)
        ? prev.filter(id => id !== pointId)
        : [...prev, pointId]
    );
  };

  const getPositionColor = (position: string) => {
    switch(position) {
      case 'HANDLER':
      case 'CENTER_HANDLER':
      case 'RESET_HANDLER':
        return 'bg-blue-100 text-blue-800';
      case 'CUTTER':
      case 'INITIATING_CUTTER':
      case 'FILL_CUTTER':
      case 'DEEP_CUTTER':
        return 'bg-green-100 text-green-800';
      case 'FRONT_OF_STACK':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Drag and drop handlers
  const handleDefenderDragStart = (e: React.DragEvent, defender: any) => {
    setDraggedDefender(defender);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handlePlayerDragOver = (e: React.DragEvent, playerId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverPlayer(playerId);
  };

  const handlePlayerDragLeave = () => {
    setDragOverPlayer(null);
  };

  const handlePlayerDrop = (e: React.DragEvent, playerId: string) => {
    e.preventDefault();
    if (draggedDefender) {
      addDefenderToCurrentPoint(playerId, draggedDefender.id);
    }
    setDraggedDefender(null);
    setDragOverPlayer(null);
  };

  const handleDefenderDragEnd = () => {
    setDraggedDefender(null);
    setDragOverPlayer(null);
  };

  const exportGameData = async (format: 'json' | 'csv') => {
    if (!game) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5001/api'}/export/game/${game.id}/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `game-${game.slug}-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getPlayingTimeStats = () => {
    const stats: any = {};
    
    if (!game?.team?.defenders || !game?.points) return [];

    game.team.defenders.forEach((defender: any) => {
      stats[defender.id] = {
        id: defender.id,
        name: defender.name,
        pointsPlayed: 0,
        breaks: 0,
        noBreaks: 0
      };
    });

    game.points.forEach((point: any) => {
      point.matchups?.forEach((matchup: any) => {
        if (matchup.defender && stats[matchup.defender.id]) {
          stats[matchup.defender.id].pointsPlayed++;
          if (point.gotBreak) {
            stats[matchup.defender.id].breaks++;
          } else {
            stats[matchup.defender.id].noBreaks++;
          }
        }
      });
    });

    return Object.values(stats).sort((a: any, b: any) => b.pointsPlayed - a.pointsPlayed);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading game...</div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Game not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            {!isPublic && (
              <div className="flex items-center space-x-2">
                {game?.isPublic && (
                  <button
                    onClick={() => {
                      const shareUrl = `${window.location.origin}/public/game/${game.shareCode}`;
                      navigator.clipboard.writeText(shareUrl);
                      alert('Share link copied to clipboard!');
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center"
                  >
                    <Share2 className="h-4 w-4 mr-1" />
                    Share Link
                  </button>
                )}
                {game?.status !== 'COMPLETED' && (
                  <button
                    onClick={() => {
                      if (confirm('Mark this game as complete? This will finalize all statistics.')) {
                        updateGameStatusMutation.mutate('COMPLETED');
                      }
                    }}
                    className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium flex items-center"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete Game
                  </button>
                )}
                <button
                  onClick={clearCurrentPoint}
                  className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded text-sm font-medium"
                >
                  Clear Point
                </button>
                <div className="relative group">
                  <button className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium flex items-center">
                    <Download className="h-4 w-4 mr-1" />
                    Export
                  </button>
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 hidden group-hover:block">
                    <button
                      onClick={() => exportGameData('json')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as JSON
                    </button>
                    <button
                      onClick={() => exportGameData('csv')}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      Export as CSV
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-semibold truncate">{game.name}</h1>
              {game.status === 'COMPLETED' && (
                <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                  Completed
                </span>
              )}
              {game.status === 'IN_PROGRESS' && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">
                  In Progress
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {isPublic ? 'View-only mode' : game.status === 'COMPLETED' ? 'Game finalized' : 'Auto-saving changes'}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Point Control Section */}
        {!isPublic && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-700 text-white px-4 py-3">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-medium">Current Point</h2>
                <div className="flex items-center space-x-3">
                  {(() => {
                    const settings = JSON.parse(localStorage.getItem('appSettings') || '{}');
                    return settings?.gameDefaults?.showTimer && pointStartTime ? (
                      <div className="flex items-center text-sm text-gray-200">
                        <Clock className="h-4 w-4 mr-1" />
                        {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
                      </div>
                    ) : null;
                  })()}
                  {unsavedChanges && (
                    <div className="flex items-center text-sm text-yellow-300">
                      <Save className="h-4 w-4 mr-1" />
                      Unsaved
                    </div>
                  )}
                  <div className="px-3 py-1 rounded-md text-white text-sm font-medium" style={{ backgroundColor: '#3E8EDE' }}>
                    Point #{(game.points?.length || 0) + 1}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => savePoint(true)}
                  disabled={currentPoint.length === 0}
                  className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all disabled:opacity-50 ${
                    lastButtonClicked === 'break' 
                      ? 'bg-emerald-800 scale-95' 
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  Break ✓
                </button>
                <button
                  onClick={() => savePoint(false)}
                  disabled={currentPoint.length === 0}
                  className={`flex-1 px-4 py-2 text-white rounded-md font-medium text-sm transition-all disabled:opacity-50 ${
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
        )}

        {/* Draggable Defenders Roster */}
        {!isPublic && defenders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-800 flex items-center">
                <Users className="h-4 w-4 mr-2" />
                Available Defenders (Drag to assign)
              </h3>
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              {defenders.map((defender: any) => {
                const isAssigned = currentPoint.some(cp => cp.defenderId === defender.id);
                return (
                  <div
                    key={defender.id}
                    draggable={!isAssigned}
                    onDragStart={(e) => handleDefenderDragStart(e, defender)}
                    onDragEnd={handleDefenderDragEnd}
                    className={`px-3 py-2 rounded-lg cursor-move transition-all ${
                      isAssigned 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' 
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 hover:shadow-md'
                    } ${
                      draggedDefender?.id === defender.id ? 'opacity-50 scale-95' : ''
                    }`}
                    style={{
                      backgroundColor: isAssigned ? undefined : '#E8F3FF',
                      color: isAssigned ? undefined : '#3E8EDE'
                    }}
                  >
                    <span className="font-medium">{defender.name}</span>
                    {defender.jerseyNumber && (
                      <span className="ml-2 text-xs opacity-75">#{defender.jerseyNumber}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Matchups Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="font-medium text-gray-800">Matchups</h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Offensive Player</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Position</th>
                  <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Defender</th>
                  {!isPublic && (
                    <th className="px-2 sm:px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delete</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {game.offensivePlayers?.filter((p: any) => !p.isBench).map((player: any, index: number) => {
                  const currentDefender = currentPoint.find(cp => cp.offensivePlayerId === player.id);
                  return (
                    <tr 
                      key={player.id} 
                      className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'} ${
                        dragOverPlayer === player.id ? 'bg-blue-50 ring-2 ring-blue-400' : ''
                      } transition-all`}
                      onDragOver={(e) => handlePlayerDragOver(e, player.id)}
                      onDragLeave={handlePlayerDragLeave}
                      onDrop={(e) => handlePlayerDrop(e, player.id)}
                    >
                      <td className="px-2 sm:px-4 py-3">
                        <span className="font-medium text-gray-900">{player.name}</span>
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        {!isPublic ? (
                          <select
                            value={player.position}
                            onChange={(e) => updateOffensivePlayerMutation.mutate({
                              playerId: player.id,
                              data: { position: e.target.value }
                            })}
                            className={`px-2 py-1 text-xs font-medium rounded-full border-0 focus:outline-none w-full max-w-32 ${
                              getPositionColor(player.position)
                            }`}
                          >
                            {offensivePositions.map(pos => (
                              <option key={pos} value={pos}>{pos.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPositionColor(player.position)}`}>
                            {player.position.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-2 sm:px-4 py-3">
                        {!isPublic ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={currentDefender?.defenderId || ''}
                              onChange={(e) => {
                                if (e.target.value) {
                                  addDefenderToCurrentPoint(player.id, e.target.value);
                                } else {
                                  removeDefenderFromCurrentPoint(player.id);
                                }
                              }}
                              className="text-sm px-2 py-1 border rounded"
                            >
                              <option value="">Select defender...</option>
                              {defenders.map((defender: any) => (
                                <option key={defender.id} value={defender.id}>
                                  {defender.name}
                                </option>
                              ))}
                            </select>
                            {currentDefender && (
                              <button
                                onClick={() => removeDefenderFromCurrentPoint(player.id)}
                                className="text-red-500 hover:text-red-700"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-500">-</span>
                        )}
                      </td>
                      {!isPublic && (
                        <td className="px-2 sm:px-4 py-3">
                          <button
                            onClick={() => deleteOffensivePlayerMutation.mutate(player.id)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                
                {/* Bench separator */}
                {game.offensivePlayers?.some((p: any) => p.isBench) && (
                  <tr>
                    <td colSpan={isPublic ? 3 : 4} className="px-4 py-2 text-center bg-gray-100">
                      <span className="text-sm font-semibold text-gray-600 uppercase">— Bench —</span>
                    </td>
                  </tr>
                )}
                
                {/* Bench players */}
                {game.offensivePlayers?.filter((p: any) => p.isBench).map((player: any, index: number) => (
                  <tr key={player.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-2 sm:px-4 py-3">
                      <span className="font-medium text-gray-900">{player.name}</span>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPositionColor(player.position)}`}>
                        {player.position.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-2 sm:px-4 py-3">
                      <span className="text-gray-400">Bench</span>
                    </td>
                    {!isPublic && (
                      <td className="px-2 sm:px-4 py-3">
                        <button
                          onClick={() => deleteOffensivePlayerMutation.mutate(player.id)}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Offensive Players */}
        {!isPublic && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium mb-4 text-gray-800">Add Offensive Player</h2>
            <div className="space-y-3">
              <input
                type="text"
                value={newOffenderName}
                onChange={(e) => setNewOffenderName(e.target.value)}
                placeholder="Offensive player name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
                onKeyPress={(e) => e.key === 'Enter' && addOffender()}
              />
              <select
                value={newOffenderPosition}
                onChange={(e) => setNewOffenderPosition(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              >
                {offensivePositions.map(pos => (
                  <option key={pos} value={pos}>{pos.replace(/_/g, ' ')}</option>
                ))}
              </select>
              <button
                onClick={addOffender}
                disabled={!newOffenderName.trim()}
                className="w-full px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 text-base"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Add Player
              </button>
            </div>
          </div>
        )}

        {/* Game Statistics */}
        {game.team?.defenders && game.team.defenders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium mb-4 text-gray-800">Game Statistics</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Player</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Points</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">Breaks</th>
                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">%</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {getPlayingTimeStats().map((player: any, index: number) => (
                    <tr key={player.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-3 py-2 font-medium text-gray-900">{player.name}</td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" 
                              style={{ backgroundColor: '#3E8EDE' }}>
                          {player.pointsPlayed}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          {player.breaks}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Point History */}
        {game.points && game.points.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h2 className="text-lg font-medium mb-4 text-gray-800">Point History ({game.points.length})</h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {[...game.points].reverse().map((point: any, index: number) => {
                const isExpanded = expandedPoints.includes(point.id);
                const pointNumber = game.points.length - index;
                return (
                  <div key={point.id} className={`rounded-lg border-l-4 ${
                    point.gotBreak ? 'bg-emerald-50 border-emerald-500' : 'bg-rose-50 border-rose-500'
                  }`}>
                    <div 
                      className="p-3 cursor-pointer hover:bg-opacity-80"
                      onClick={() => togglePointExpansion(point.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            point.gotBreak 
                              ? 'bg-emerald-500 text-white' 
                              : 'bg-rose-500 text-white'
                          }`}>
                            {point.gotBreak ? 'BREAK' : 'NO BREAK'}
                          </span>
                          <span className="text-xs text-gray-600">
                            Point #{pointNumber}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          {!isPublic && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deletePointMutation.mutate(point.id);
                              }}
                              className="p-1 text-red-600 hover:text-red-800 rounded"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          )}
                          <span className="text-gray-400 text-sm">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="px-3 pb-3">
                        <div className="space-y-2">
                          {point.matchups?.map((matchup: any, idx: number) => (
                            <div key={idx} className="text-sm bg-white rounded p-2 border flex items-center justify-between">
                              <span className="font-medium text-gray-800">
                                {matchup.offensivePlayer?.name || 'Unknown'}
                              </span>
                              <span className="text-gray-600">vs</span>
                              <span className="font-medium text-gray-800">
                                {matchup.defender?.name || 'Unassigned'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}