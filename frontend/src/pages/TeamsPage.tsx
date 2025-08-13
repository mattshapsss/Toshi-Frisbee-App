import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Users, Settings, UserPlus, ArrowLeft, Trash2 } from 'lucide-react';
import { teamsApi } from '../lib/api';
import { useTeamStore } from '../stores/teamStore';

export default function TeamsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [showInviteMember, setShowInviteMember] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [showJoinTeam, setShowJoinTeam] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Check URL params on mount to open the right form
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'create') {
      setShowCreateTeam(true);
    } else if (action === 'join') {
      setShowJoinTeam(true);
    }
  }, [searchParams]);

  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: teamsApi.list
  });

  const { setCurrentTeam } = useTeamStore();

  const createTeamMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: (newTeam) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateTeam(false);
      setNewTeamName('');
      setNewTeamDescription('');
      // Set the new team as current and redirect to home
      const teamWithRole = { ...newTeam, role: 'OWNER' };
      setCurrentTeam(teamWithRole);
      navigate('/');
    }
  });

  const inviteMemberMutation = useMutation({
    mutationFn: ({ teamId, data }: any) => teamsApi.inviteMember(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowInviteMember(null);
      setInviteEmail('');
    }
  });

  const leaveTeamMutation = useMutation({
    mutationFn: teamsApi.leave,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    }
  });

  const joinTeamMutation = useMutation({
    mutationFn: (inviteCode: string) => teamsApi.joinByCode(inviteCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setShowJoinTeam(false);
      setJoinCode('');
      alert('Successfully joined team!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to join team. Check your invite code.');
    }
  });

  const updateTeamMutation = useMutation({
    mutationFn: ({ teamId, data }: any) => teamsApi.update(teamId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setEditingTeam(null);
      setEditName('');
      setEditDescription('');
      alert('Team updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update team.');
    }
  });

  const deleteTeamMutation = useMutation({
    mutationFn: teamsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      setCurrentTeam(null);
      alert('Team deleted successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to delete team.');
    }
  });

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    createTeamMutation.mutate({
      name: newTeamName.trim(),
      description: newTeamDescription.trim() || undefined
    });
  };

  const handleInviteMember = (teamId: string) => {
    if (!inviteEmail.trim()) return;
    inviteMemberMutation.mutate({
      teamId,
      data: { emailOrUsername: inviteEmail.trim() }
    });
  };

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
              <h1 className="text-xl font-semibold">Teams</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowJoinTeam(true)}
                className="px-2 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm sm:text-base"
              >
                <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2 inline" />
                <span className="hidden sm:inline">Join Team</span>
                <span className="sm:hidden">Join</span>
              </button>
              <button
                onClick={() => setShowCreateTeam(true)}
                className="px-2 sm:px-4 py-2 bg-tufts-blue text-white rounded-lg hover:opacity-90 text-sm sm:text-base"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2 inline" />
                <span className="hidden sm:inline">New Team</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Join Team Form */}
        {showJoinTeam && (
          <div className="bg-green-50 border border-green-200 rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Join Existing Team</h3>
            <p className="text-gray-600 mb-4">Enter the 6-character invite code from your team captain:</p>
            <div className="space-y-4">
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code (e.g., AUDM7X)"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-xl font-mono uppercase"
              />
              <div className="flex space-x-2">
                <button
                  onClick={() => joinTeamMutation.mutate(joinCode)}
                  disabled={joinCode.length !== 6 || joinTeamMutation.isPending}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-medium disabled:bg-gray-300 hover:bg-green-700"
                >
                  Join Team
                </button>
                <button
                  onClick={() => {
                    setShowJoinTeam(false);
                    setJoinCode('');
                  }}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Team Form */}
        {showCreateTeam && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Create New Team</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="Team name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <textarea
                value={newTeamDescription}
                onChange={(e) => setNewTeamDescription(e.target.value)}
                placeholder="Team description (optional)"
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex space-x-2">
                <button
                  onClick={handleCreateTeam}
                  disabled={!newTeamName.trim() || createTeamMutation.isPending}
                  className="flex-1 px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90"
                  style={{ backgroundColor: '#3E8EDE' }}
                >
                  Create Team
                </button>
                <button
                  onClick={() => {
                    setShowCreateTeam(false);
                    setNewTeamName('');
                    setNewTeamDescription('');
                  }}
                  className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Teams List */}
        <div className="space-y-4">
          {teams.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-600 mb-2">No Teams Yet</h4>
              <p className="text-gray-500">Create or join a team to start tracking games.</p>
            </div>
          ) : (
            teams.map((team: any) => (
              <div key={team.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800">{team.name}</h3>
                    {team.description && (
                      <p className="text-gray-600 mt-1">{team.description}</p>
                    )}
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {team.role}
                      </span>
                      <span>{team._count?.members || 0} members</span>
                      <span>{team._count?.defenders || 0} defenders</span>
                      <span>{team._count?.games || 0} games</span>
                    </div>
                    {team.inviteCode && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-700">Team Invite Code:</p>
                            <p className="text-2xl font-mono font-bold text-blue-600">{team.inviteCode}</p>
                          </div>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(team.inviteCode);
                              alert('Invite code copied to clipboard!');
                            }}
                            className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                          >
                            Copy Code
                          </button>
                        </div>
                        <p className="text-xs text-gray-600 mt-2">Share this code with teammates to let them join</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/teams/${team.id}/roster`)}
                      className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                      title="Manage roster"
                    >
                      <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                    </button>
                    {(team.role === 'OWNER' || team.role === 'ADMIN') && (
                      <button
                        onClick={() => setShowInviteMember(team.id)}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                        title="Invite member"
                      >
                        <UserPlus className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                    {(team.role === 'OWNER' || team.role === 'ADMIN') && (
                      <button
                        onClick={() => {
                          setEditingTeam(team);
                          setEditName(team.name);
                          setEditDescription(team.description || '');
                        }}
                        className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
                        title="Team settings"
                      >
                        <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Edit Team Form */}
                {editingTeam?.id === team.id && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">Edit Team Settings</h4>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Team name"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Team description (optional)"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            if (!editName.trim()) return;
                            updateTeamMutation.mutate({
                              teamId: team.id,
                              data: {
                                name: editName.trim(),
                                description: editDescription.trim() || undefined
                              }
                            });
                          }}
                          disabled={!editName.trim() || updateTeamMutation.isPending}
                          className="flex-1 px-4 py-2 bg-tufts-blue text-white rounded-lg hover:opacity-90 text-sm disabled:bg-gray-300"
                          style={{ backgroundColor: '#3E8EDE' }}
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            setEditingTeam(null);
                            setEditName('');
                            setEditDescription('');
                          }}
                          className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                      {team.role === 'OWNER' && (
                        <div className="pt-3 border-t border-red-200">
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete "${team.name}"? This will permanently delete all team data including games, defenders, and statistics. This action cannot be undone.`)) {
                                deleteTeamMutation.mutate(team.id);
                              }
                            }}
                            className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                          >
                            Delete Team Permanently
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invite Member Form */}
                {showInviteMember === team.id && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Invite Team Member</h4>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="Email or username"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <button
                        onClick={() => handleInviteMember(team.id)}
                        disabled={!inviteEmail.trim() || inviteMemberMutation.isPending}
                        className="px-4 py-2 bg-tufts-blue text-white rounded-lg hover:opacity-90 text-sm disabled:bg-gray-300"
                        style={{ backgroundColor: '#3E8EDE' }}
                      >
                        Invite
                      </button>
                      <button
                        onClick={() => {
                          setShowInviteMember(null);
                          setInviteEmail('');
                        }}
                        className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={() => {
                      setCurrentTeam(team);
                      navigate('/');
                    }}
                    className="px-4 py-2 bg-tufts-blue text-white rounded-lg hover:opacity-90 text-sm"
                    style={{ backgroundColor: '#3E8EDE' }}
                  >
                    View Games
                  </button>
                  {team.role !== 'OWNER' && (
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to leave this team?')) {
                          leaveTeamMutation.mutate(team.id);
                        }
                      }}
                      className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 text-sm"
                    >
                      Leave Team
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}