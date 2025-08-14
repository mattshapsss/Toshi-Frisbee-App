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
    } else {
      // Add defender
      if (newSelection.length >= 7) {
        // Silently prevent adding more than 7
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
    
    // Just load the line without warnings
    setSelectedDefenders(defenderIds);
    updateSelectedDefendersMutation.mutate(defenderIds);
    setShowLineDropdown(false);
  };

  // Group defenders by position and sort alphabetically within each group
  const groupedDefenders = {
    HANDLER: defenders.filter((d: any) => d.position === 'HANDLER').sort((a: any, b: any) => a.name.localeCompare(b.name)),
    HYBRID: defenders.filter((d: any) => d.position === 'HYBRID' || !d.position).sort((a: any, b: any) => a.name.localeCompare(b.name)),
    CUTTER: defenders.filter((d: any) => d.position === 'CUTTER').sort((a: any, b: any) => a.name.localeCompare(b.name))
  };

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Handlers Column */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Handlers</h4>
            <div className="space-y-2">
              {groupedDefenders.HANDLER.map((defender: any) => {
                const isSelected = selectedDefenders.includes(defender.id);
                const isInCurrentPoint = offensivePlayers.some(
                  (player: any) => player.currentPointDefender?.defenderId === defender.id
                );
                
                return (
                  <button
                    key={defender.id}
                    onClick={() => handleToggleDefender(defender.id)}
                    disabled={isPublic}
                    className={`
                      relative w-full px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
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
                    {isInCurrentPoint && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
              {groupedDefenders.HANDLER.length === 0 && (
                <div className="text-xs text-gray-400 italic">No handlers</div>
              )}
            </div>
          </div>

          {/* Hybrids Column */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Hybrids</h4>
            <div className="space-y-2">
              {groupedDefenders.HYBRID.map((defender: any) => {
                const isSelected = selectedDefenders.includes(defender.id);
                const isInCurrentPoint = offensivePlayers.some(
                  (player: any) => player.currentPointDefender?.defenderId === defender.id
                );
                
                return (
                  <button
                    key={defender.id}
                    onClick={() => handleToggleDefender(defender.id)}
                    disabled={isPublic}
                    className={`
                      relative w-full px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
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
                    {isInCurrentPoint && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
              {groupedDefenders.HYBRID.length === 0 && (
                <div className="text-xs text-gray-400 italic">No hybrids</div>
              )}
            </div>
          </div>

          {/* Cutters Column */}
          <div>
            <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Cutters</h4>
            <div className="space-y-2">
              {groupedDefenders.CUTTER.map((defender: any) => {
                const isSelected = selectedDefenders.includes(defender.id);
                const isInCurrentPoint = offensivePlayers.some(
                  (player: any) => player.currentPointDefender?.defenderId === defender.id
                );
                
                return (
                  <button
                    key={defender.id}
                    onClick={() => handleToggleDefender(defender.id)}
                    disabled={isPublic}
                    className={`
                      relative w-full px-3 py-2 rounded-lg text-sm font-medium transition-all text-left
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
                    {isInCurrentPoint && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
              {groupedDefenders.CUTTER.length === 0 && (
                <div className="text-xs text-gray-400 italic">No cutters</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}