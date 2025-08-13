import React, { useState, useEffect } from 'react';
import { ChevronDown, Users } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { selectedDefendersApi, linesApi } from '../lib/api';
import { socketManager } from '../lib/socket';

interface CallYourLineProps {
  gameId: string;
  teamId: string;
  defenders: any[];
  offensivePlayers: any[];
  isPublic?: boolean;
  onSelectionChange?: (selectedDefenderIds: string[]) => void;
}

export default function CallYourLine({
  gameId,
  teamId,
  defenders,
  offensivePlayers,
  isPublic = false,
  onSelectionChange,
}: CallYourLineProps) {
  const queryClient = useQueryClient();
  const [selectedDefenders, setSelectedDefenders] = useState<string[]>([]);
  const [showLineDropdown, setShowLineDropdown] = useState(false);

  // Fetch selected defenders for this game
  const { data: selectedDefendersData } = useQuery({
    queryKey: ['selectedDefenders', gameId],
    queryFn: () => selectedDefendersApi.getByGame(gameId),
    enabled: !!gameId && !isPublic,
  });

  // Fetch defensive lines for the team
  const { data: defensiveLines = [] } = useQuery({
    queryKey: ['defensiveLines', teamId],
    queryFn: () => linesApi.listByTeam(teamId),
    enabled: !!teamId && !isPublic,
  });

  // Update selected defenders mutation
  const updateSelectedDefendersMutation = useMutation({
    mutationFn: (defenderIds: string[]) => 
      selectedDefendersApi.updateByGame(gameId, defenderIds),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['selectedDefenders', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      if (onSelectionChange) {
        onSelectionChange(data.map((sd: any) => sd.defenderId));
      }
    },
  });

  // Initialize selected defenders from server data
  useEffect(() => {
    if (selectedDefendersData) {
      const defenderIds = selectedDefendersData.map((sd: any) => sd.defenderId);
      setSelectedDefenders(defenderIds);
      if (onSelectionChange) {
        onSelectionChange(defenderIds);
      }
    }
  }, [selectedDefendersData]);

  // Setup WebSocket listeners
  useEffect(() => {
    if (!gameId || isPublic) return;

    const handleSelectedDefendersUpdated = (data: any) => {
      const defenderIds = data.map((sd: any) => sd.defenderId);
      setSelectedDefenders(defenderIds);
      queryClient.invalidateQueries({ queryKey: ['selectedDefenders', gameId] });
      queryClient.invalidateQueries({ queryKey: ['game', gameId] });
      if (onSelectionChange) {
        onSelectionChange(defenderIds);
      }
    };

    socketManager.on('selected-defenders-updated', handleSelectedDefendersUpdated);

    return () => {
      socketManager.off('selected-defenders-updated', handleSelectedDefendersUpdated);
    };
  }, [gameId, isPublic, queryClient, onSelectionChange]);

  const handleToggleDefender = (defenderId: string) => {
    if (isPublic) return;

    let newSelection = [...selectedDefenders];
    
    if (newSelection.includes(defenderId)) {
      // Remove defender
      newSelection = newSelection.filter(id => id !== defenderId);
      
      // Check if this defender is in any current point assignment
      const isInCurrentPoint = offensivePlayers.some(
        player => player.currentPointDefender?.defenderId === defenderId
      );
      
      if (isInCurrentPoint) {
        if (!confirm('This defender is currently assigned. Removing them will clear their assignment. Continue?')) {
          return;
        }
      }
    } else {
      // Add defender
      if (newSelection.length >= 7) {
        alert('Maximum 7 defenders can be selected for a point');
        return;
      }
      newSelection.push(defenderId);
    }

    setSelectedDefenders(newSelection);
    updateSelectedDefendersMutation.mutate(newSelection);
  };

  const handleLoadLine = (line: any) => {
    if (isPublic) return;

    const defenderIds = line.defenders.map((ld: any) => ld.defender.id);
    
    // Check if any currently assigned defenders will be removed
    const currentlyAssignedDefenders = offensivePlayers
      .filter(player => player.currentPointDefender)
      .map(player => player.currentPointDefender.defenderId);
    
    const defendersToRemove = currentlyAssignedDefenders.filter(
      id => !defenderIds.includes(id)
    );
    
    if (defendersToRemove.length > 0) {
      if (!confirm(`Loading this line will remove ${defendersToRemove.length} currently assigned defender(s). Continue?`)) {
        return;
      }
    }

    setSelectedDefenders(defenderIds);
    updateSelectedDefendersMutation.mutate(defenderIds);
    setShowLineDropdown(false);
  };

  // Sort defenders alphabetically
  const sortedDefenders = [...defenders].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-800">Call Your Line</h3>
            <span className="text-sm text-gray-500">
              ({selectedDefenders.length}/7 selected)
            </span>
          </div>
          {!isPublic && defensiveLines.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowLineDropdown(!showLineDropdown)}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Load Line
                <ChevronDown className="h-4 w-4" />
              </button>
              {showLineDropdown && (
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    {defensiveLines.map((line: any) => (
                      <button
                        key={line.id}
                        onClick={() => handleLoadLine(line)}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        {line.name} ({line.defenders.length} players)
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-2">
          {sortedDefenders.map((defender) => {
            const isSelected = selectedDefenders.includes(defender.id);
            const isInCurrentPoint = offensivePlayers.some(
              player => player.currentPointDefender?.defenderId === defender.id
            );
            
            return (
              <button
                key={defender.id}
                onClick={() => handleToggleDefender(defender.id)}
                disabled={isPublic}
                className={`
                  relative px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${isPublic ? 'cursor-not-allowed' : 'cursor-pointer'}
                  ${isSelected 
                    ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-sm' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300'
                  }
                  ${isInCurrentPoint && isSelected ? 'ring-2 ring-emerald-500' : ''}
                `}
                style={isSelected ? { backgroundColor: '#3E8EDE' } : {}}
              >
                <span className="block truncate">{defender.name}</span>
                {defender.jerseyNumber && (
                  <span className="text-xs opacity-75">#{defender.jerseyNumber}</span>
                )}
                {isInCurrentPoint && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                )}
              </button>
            );
          })}
        </div>
        
        {selectedDefenders.length === 7 && (
          <div className="mt-3 text-sm text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
            Maximum 7 defenders selected. Deselect a defender to add another.
          </div>
        )}
        
        {!isPublic && selectedDefenders.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              <strong>Selected defenders statistics:</strong>
            </div>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              {(() => {
                const stats = calculateSelectedDefendersStats(
                  selectedDefenders,
                  defenders,
                  offensivePlayers
                );
                return (
                  <>
                    <div>
                      <span className="text-gray-500">Points Played:</span>{' '}
                      <span className="font-medium">{stats.totalPoints}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Breaks:</span>{' '}
                      <span className="font-medium text-emerald-600">{stats.breaks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">No Breaks:</span>{' '}
                      <span className="font-medium text-rose-600">{stats.noBreaks}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Break %:</span>{' '}
                      <span className="font-medium">
                        {stats.totalPoints > 0 
                          ? `${Math.round((stats.breaks / stats.totalPoints) * 100)}%`
                          : 'N/A'
                        }
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function calculateSelectedDefendersStats(
  selectedDefenderIds: string[],
  defenders: any[],
  offensivePlayers: any[]
) {
  // This would normally calculate from game points data
  // For now, returning placeholder values
  // In a real implementation, this would query the points/matchups data
  return {
    totalPoints: 0,
    breaks: 0,
    noBreaks: 0,
  };
}