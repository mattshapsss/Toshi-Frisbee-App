import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Save, X, Users } from 'lucide-react';
import { linesApi } from '../lib/api';

interface BuildLinesProps {
  teamId: string;
  defenders: any[];
}

export default function BuildLines({ teamId, defenders }: BuildLinesProps) {
  const queryClient = useQueryClient();
  const [newLineName, setNewLineName] = useState('');
  const [selectedDefenders, setSelectedDefenders] = useState<string[]>([]);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineName, setEditingLineName] = useState('');
  const [editingLineDefenders, setEditingLineDefenders] = useState<string[]>([]);

  // Fetch defensive lines
  const { data: lines = [], isLoading } = useQuery({
    queryKey: ['defensiveLines', teamId],
    queryFn: () => linesApi.listByTeam(teamId),
    enabled: !!teamId,
  });

  // Create line mutation
  const createLineMutation = useMutation({
    mutationFn: (data: { teamId: string; name: string; defenderIds: string[] }) =>
      linesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defensiveLines', teamId] });
      setNewLineName('');
      setSelectedDefenders([]);
    },
  });

  // Update line mutation
  const updateLineMutation = useMutation({
    mutationFn: ({ lineId, data }: { lineId: string; data: any }) =>
      linesApi.update(lineId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defensiveLines', teamId] });
      setEditingLineId(null);
      setEditingLineName('');
      setEditingLineDefenders([]);
    },
  });

  // Delete line mutation
  const deleteLineMutation = useMutation({
    mutationFn: (lineId: string) => linesApi.delete(lineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['defensiveLines', teamId] });
    },
  });

  const handleCreateLine = () => {
    if (!newLineName.trim() || selectedDefenders.length === 0) {
      // Silently prevent creation without name or defenders
      return;
    }

    if (selectedDefenders.length > 7) {
      // Silently prevent more than 7 defenders
      return;
    }

    createLineMutation.mutate({
      teamId,
      name: newLineName.trim(),
      defenderIds: selectedDefenders,
    });
  };

  const handleEditLine = (line: any) => {
    setEditingLineId(line.id);
    setEditingLineName(line.name);
    setEditingLineDefenders(line.defenders.map((ld: any) => ld.defender.id));
  };

  const handleSaveEdit = () => {
    if (!editingLineName.trim() || editingLineDefenders.length === 0) {
      // Silently prevent saving without name or defenders
      return;
    }

    if (editingLineDefenders.length > 7) {
      // Silently prevent more than 7 defenders
      return;
    }

    updateLineMutation.mutate({
      lineId: editingLineId!,
      data: {
        name: editingLineName.trim(),
        defenderIds: editingLineDefenders,
      },
    });
  };

  const handleCancelEdit = () => {
    setEditingLineId(null);
    setEditingLineName('');
    setEditingLineDefenders([]);
  };

  const handleDeleteLine = (lineId: string) => {
    if (confirm('Are you sure you want to delete this defensive line?')) {
      deleteLineMutation.mutate(lineId);
    }
  };

  const toggleDefender = (defenderId: string, isEditing = false) => {
    const setters = isEditing 
      ? { get: editingLineDefenders, set: setEditingLineDefenders }
      : { get: selectedDefenders, set: setSelectedDefenders };

    if (setters.get.includes(defenderId)) {
      setters.set(setters.get.filter(id => id !== defenderId));
    } else {
      if (setters.get.length >= 7) {
        // Silently prevent more than 7 defenders
        return;
      }
      setters.set([...setters.get, defenderId]);
    }
  };

  // Sort defenders alphabetically
  const sortedDefenders = [...defenders].sort((a, b) => 
    a.name.localeCompare(b.name)
  );

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 flex items-center">
          <Users className="h-5 w-5 mr-2" />
          Build Defensive Lines
        </h2>
        <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
          {lines.length} lines
        </span>
      </div>

      {/* Create New Line */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Create New Line</h3>
        <div className="space-y-3">
          <input
            type="text"
            value={newLineName}
            onChange={(e) => setNewLineName(e.target.value)}
            placeholder="Enter line name (e.g., 'Starting 7', 'Zone Defense')"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {sortedDefenders.map((defender) => {
              const isSelected = selectedDefenders.includes(defender.id);
              return (
                <button
                  key={defender.id}
                  onClick={() => toggleDefender(defender.id)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    isSelected
                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                  style={isSelected ? { backgroundColor: '#3E8EDE' } : {}}
                >
                  {defender.name}
                  {defender.jerseyNumber && (
                    <span className="text-xs ml-1 opacity-75">#{defender.jerseyNumber}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {selectedDefenders.length}/7 defenders selected
            </span>
            <button
              onClick={handleCreateLine}
              disabled={!newLineName.trim() || selectedDefenders.length === 0 || createLineMutation.isPending}
              className="px-4 py-2 text-white rounded-md font-medium disabled:bg-gray-300 hover:opacity-90 flex items-center"
              style={{ backgroundColor: '#3E8EDE' }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Line
            </button>
          </div>
        </div>
      </div>

      {/* Existing Lines */}
      {lines.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">Existing Lines</h3>
          {lines.map((line: any) => (
            <div key={line.id} className="border border-gray-200 rounded-lg p-4">
              {editingLineId === line.id ? (
                // Edit Mode
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingLineName}
                    onChange={(e) => setEditingLineName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {sortedDefenders.map((defender) => {
                      const isSelected = editingLineDefenders.includes(defender.id);
                      return (
                        <button
                          key={defender.id}
                          onClick={() => toggleDefender(defender.id, true)}
                          className={`px-3 py-2 rounded-md text-sm font-medium transition-all ${
                            isSelected
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                          }`}
                          style={isSelected ? { backgroundColor: '#3E8EDE' } : {}}
                        >
                          {defender.name}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {editingLineDefenders.length}/7 defenders selected
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCancelEdit}
                        className="px-3 py-1 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        <X className="h-4 w-4" />
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={!editingLineName.trim() || editingLineDefenders.length === 0}
                        className="px-3 py-1 text-white rounded-md disabled:bg-gray-300"
                        style={{ backgroundColor: '#3E8EDE' }}
                      >
                        <Save className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{line.name}</h4>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {line.defenders.map((ld: any) => (
                        <span
                          key={ld.id}
                          className="px-2 py-1 text-xs font-medium text-white rounded-md"
                          style={{ backgroundColor: '#3E8EDE' }}
                        >
                          {ld.defender.name}
                          {ld.defender.jerseyNumber && (
                            <span className="ml-1 opacity-75">#{ld.defender.jerseyNumber}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditLine(line)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteLine(line.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {lines.length === 0 && !isLoading && (
        <div className="text-center py-8">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-500">No defensive lines created yet</p>
          <p className="text-sm text-gray-400 mt-1">Create your first line above</p>
        </div>
      )}
    </div>
  );
}