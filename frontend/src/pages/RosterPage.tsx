import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Minus, ArrowLeft, Users, BarChart3 } from 'lucide-react';
import { defendersApi, teamsApi, gamesApi, pointsApi } from '../lib/api';
import BuildLines from '../components/BuildLines';
import SortableTableHeader, { useSortableData } from '../components/SortableTableHeader';

export default function RosterPage() {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newDefenderName, setNewDefenderName] = useState('');
  const [newDefenderPosition, setNewDefenderPosition] = useState<'HANDLER' | 'HYBRID' | 'CUTTER'>('HYBRID');
  const [bulkAdd, setBulkAdd] = useState(false);
  const [bulkNames, setBulkNames] = useState('');
  const [bulkPosition, setBulkPosition] = useState<'HANDLER' | 'HYBRID' | 'CUTTER'>('HYBRID');
  const [isMounted, setIsMounted] = useState(false);
  const [editingDefenderId, setEditingDefenderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingPosition, setEditingPosition] = useState<'HANDLER' | 'HYBRID' | 'CUTTER'>('HYBRID');

  // Ensure component is mounted on client side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch team
  const { data: team } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => teamsApi.get(teamId!),
    enabled: !!teamId
  });

  // Fetch defenders
  const { data: defenders = [] } = useQuery({
    queryKey: ['defenders', teamId],
    queryFn: () => defendersApi.listByTeam(teamId!),
    enabled: !!teamId
  });

  // Fetch all games for this team to calculate team-level stats
  const { data: teamGames = [] } = useQuery({
    queryKey: ['games', teamId],
    queryFn: () => gamesApi.list({ teamId }),
    enabled: !!teamId
  });

  // Calculate team-level statistics
  const calculateTeamStats = () => {
    let totalPoints = 0;
    let totalBreaks = 0;
    
    // Count unique points across all games
    teamGames.forEach((game: any) => {
      if (game.points) {
        totalPoints += game.points.length;
        totalBreaks += game.points.filter((p: any) => p.gotBreak).length;
      }
    });
    
    return { totalPoints, totalBreaks };
  };

  const teamStats = calculateTeamStats();

  // Create defender mutation
  const createDefenderMutation = useMutation({
    mutationFn: defendersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defenders', teamId] });
      setNewDefenderName('');
      setNewDefenderPosition('HYBRID');
    }
  });

  // Update defender mutation
  const updateDefenderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => defendersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defenders', teamId] });
      setEditingDefenderId(null);
      setEditingName('');
      setEditingPosition('HYBRID');
    }
  });

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: ({ names, position }: { names: string[]; position: 'HANDLER' | 'HYBRID' | 'CUTTER' }) => 
      defendersApi.bulkCreate(teamId!, names.map(name => ({ name, position }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defenders', teamId] });
      setBulkNames('');
      setBulkPosition('HYBRID');
      setBulkAdd(false);
    }
  });

  // Delete defender mutation
  const deleteDefenderMutation = useMutation({
    mutationFn: defendersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defenders', teamId] });
    },
    onError: (error: any) => {
      console.error('Failed to delete defender:', error);
      alert(error.response?.data?.error || 'Failed to delete defender. You may not have permission to delete.');
    }
  });

  const handleAddDefender = () => {
    if (!newDefenderName.trim() || !teamId) return;
    
    // Truncate name to 10 characters for storage
    const truncatedName = newDefenderName.trim().slice(0, 10);
    
    createDefenderMutation.mutate({
      teamId,
      name: truncatedName,
      position: newDefenderPosition
    });
  };

  const handleBulkAdd = () => {
    const names = bulkNames
      .split('\n')
      .map(n => n.trim().slice(0, 10)) // Truncate each name to 10 characters
      .filter(n => n.length > 0);
    
    if (names.length === 0) return;
    bulkCreateMutation.mutate({ names, position: bulkPosition });
  };

  const handleEditDefender = (defender: any) => {
    setEditingDefenderId(defender.id);
    setEditingName(defender.name);
    setEditingPosition(defender.position || 'HYBRID');
  };

  const handleSaveEdit = () => {
    if (!editingDefenderId || !editingName.trim()) return;
    
    // Truncate name to 10 characters
    const truncatedName = editingName.trim().slice(0, 10);
    
    updateDefenderMutation.mutate({
      id: editingDefenderId,
      data: {
        name: truncatedName,
        position: editingPosition
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingDefenderId(null);
    setEditingName('');
    setEditingPosition('HYBRID');
  };

  const calculateStats = (defender: any) => {
    // Aggregate DefenderStats across all games
    const allStats = defender.statistics || [];
    const total = allStats.reduce((sum: number, stat: any) => sum + (stat.pointsPlayed || 0), 0);
    const breaks = allStats.reduce((sum: number, stat: any) => sum + (stat.breaks || 0), 0);
    const breakPercent = total > 0 ? Math.round((breaks / total) * 100) : 0;
    
    return { total, breaks, breakPercent };
  };

  // Prepare data for sorting
  const defendersWithStats = defenders.map((defender: any) => ({
    ...defender,
    stats: calculateStats(defender),
  }));

  // Use sortable data hook
  const { sortedData: sortedDefenders, sortConfig, handleSort } = useSortableData(
    defendersWithStats,
    'name',
    'asc'
  );

  if (!team) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <button
                onClick={() => navigate('/')}
                className="flex items-center text-gray-300 hover:text-white transition-colors"
              >
                <ArrowLeft className="h-5 w-5 mr-2" />
                Back
              </button>
              <h1 className="text-xl font-semibold">{team.name} - Roster & Statistics</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Add New Defender */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Add Defenders</h2>
            <button
              onClick={() => setBulkAdd(!bulkAdd)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {bulkAdd ? 'Single Add' : 'Bulk Add'}
            </button>
          </div>
          
          {bulkAdd ? (
            <div className="space-y-3">
              <textarea
                value={bulkNames}
                onChange={(e) => setBulkNames(e.target.value)}
                placeholder="Enter defender names (one per line, max 10 characters each)"
                rows={5}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-3">
                <select
                  value={bulkPosition}
                  onChange={(e) => setBulkPosition(e.target.value as 'HANDLER' | 'HYBRID' | 'CUTTER')}
                  className="w-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="HANDLER">Handler</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="CUTTER">Cutter</option>
                </select>
                <button
                  onClick={handleBulkAdd}
                  disabled={!bulkNames.trim() || bulkCreateMutation.isPending}
                  className="flex-1 px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90"
                  style={{ backgroundColor: '#3E8EDE' }}
                >
                  <Plus className="h-5 w-5 mr-2 inline" />
                  Add All Defenders
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newDefenderName}
                onChange={(e) => setNewDefenderName(e.target.value)}
                placeholder="Defender name (max 10 chars)"
                maxLength={10}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleAddDefender()}
              />
              <select
                value={newDefenderPosition}
                onChange={(e) => setNewDefenderPosition(e.target.value as 'HANDLER' | 'HYBRID' | 'CUTTER')}
                className="w-48 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="HANDLER">Handler</option>
                <option value="HYBRID">Hybrid</option>
                <option value="CUTTER">Cutter</option>
              </select>
              <button
                onClick={handleAddDefender}
                disabled={!newDefenderName.trim() || createDefenderMutation.isPending}
                className="px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                <Plus className="h-5 w-5 mr-2 inline" />
                Add
              </button>
            </div>
          )}
        </div>

        {/* Roster & Statistics Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Roster & Statistics
            </h2>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {defenders.length} defenders
            </span>
          </div>
          
          {defenders.length === 0 ? (
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
                    <SortableTableHeader
                      label="Name"
                      sortKey="name"
                      currentSortKey={sortConfig.key}
                      sortDirection={sortConfig.direction}
                      onSort={handleSort}
                      className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase"
                    />
                    <SortableTableHeader
                      label="Position"
                      sortKey="position"
                      currentSortKey={sortConfig.key}
                      sortDirection={sortConfig.direction}
                      onSort={handleSort}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                    />
                    <SortableTableHeader
                      label="Total Points"
                      sortKey="stats.total"
                      currentSortKey={sortConfig.key}
                      sortDirection={sortConfig.direction}
                      onSort={handleSort}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                    />
                    <SortableTableHeader
                      label="Breaks"
                      sortKey="stats.breaks"
                      currentSortKey={sortConfig.key}
                      sortDirection={sortConfig.direction}
                      onSort={handleSort}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                    />
                    <SortableTableHeader
                      label="Break %"
                      sortKey="stats.breakPercent"
                      currentSortKey={sortConfig.key}
                      sortDirection={sortConfig.direction}
                      onSort={handleSort}
                      className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase"
                    />
                    <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase">Delete</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedDefenders.map((defender: any, index: number) => {
                    const isEditing = editingDefenderId === defender.id;
                    const formatPosition = (pos: string) => {
                      return pos === 'HANDLER' ? 'Handler' : pos === 'CUTTER' ? 'Cutter' : 'Hybrid';
                    };
                    
                    return (
                      <tr key={defender.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-3 py-3 text-sm font-medium text-gray-900">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                maxLength={10}
                                className="px-2 py-1 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                              />
                              <button
                                onClick={handleSaveEdit}
                                className="p-1 text-green-600 hover:text-green-800"
                              >
                                ✓
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="p-1 text-red-600 hover:text-red-800"
                              >
                                ✗
                              </button>
                            </div>
                          ) : (
                            <span 
                              className="cursor-pointer hover:text-blue-600"
                              onClick={() => handleEditDefender(defender)}
                              title="Click to edit"
                            >
                              {defender.name}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {isEditing ? (
                            <select
                              value={editingPosition}
                              onChange={(e) => setEditingPosition(e.target.value as 'HANDLER' | 'HYBRID' | 'CUTTER')}
                              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none"
                            >
                              <option value="HANDLER">Handler</option>
                              <option value="HYBRID">Hybrid</option>
                              <option value="CUTTER">Cutter</option>
                            </select>
                          ) : (
                            <select
                              value={defender.position || 'HYBRID'}
                              onChange={(e) => {
                                updateDefenderMutation.mutate({
                                  id: defender.id,
                                  data: { position: e.target.value }
                                });
                              }}
                              className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${
                                defender.position === 'HANDLER' 
                                  ? 'bg-blue-100 text-blue-800'
                                  : defender.position === 'CUTTER'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              <option value="HANDLER">Handler</option>
                              <option value="HYBRID">Hybrid</option>
                              <option value="CUTTER">Cutter</option>
                            </select>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white" 
                                style={{ backgroundColor: '#3E8EDE' }}>
                            {defender.stats.total}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                            {defender.stats.breaks}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            defender.stats.total === 0 
                              ? 'bg-gray-100 text-gray-800'
                              : defender.stats.breakPercent >= 50 
                                ? 'bg-emerald-100 text-emerald-800' 
                                : 'bg-amber-100 text-amber-800'
                          }`}>
                            {defender.stats.total === 0 ? '-' : `${defender.stats.breakPercent}%`}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-center">
                          {isMounted ? (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Delete ${defender.name} from roster?`)) {
                                  deleteDefenderMutation.mutate(defender.id);
                                }
                              }}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Delete defender"
                              type="button"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                          ) : (
                            <div className="p-2">
                              <Minus className="h-4 w-4 text-gray-400" />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Build Defensive Lines */}
        {defenders.length > 0 && (
          <BuildLines teamId={teamId!} defenders={defenders} />
        )}

        {/* Summary Stats */}
        {defenders.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              Team Summary
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-800">{defenders.length}</div>
                <div className="text-sm text-gray-600">Total Defenders</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-800">
                  {teamStats.totalPoints}
                </div>
                <div className="text-sm text-gray-600">Total Points Played</div>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <div className="text-2xl font-bold text-emerald-800">
                  {teamStats.totalBreaks}
                </div>
                <div className="text-sm text-gray-600">Total Breaks</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}