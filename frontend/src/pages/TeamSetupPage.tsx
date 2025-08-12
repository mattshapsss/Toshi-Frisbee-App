import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Users, Plus, Link } from 'lucide-react';
import { teamsApi } from '../lib/api';

export default function TeamSetupPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'create' | 'join' | null>(null);
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');

  const createTeamMutation = useMutation({
    mutationFn: teamsApi.create,
    onSuccess: () => {
      navigate('/');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to create team');
    }
  });

  const joinTeamMutation = useMutation({
    mutationFn: (code: string) => teamsApi.joinByCode(code),
    onSuccess: () => {
      navigate('/');
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Invalid invite code');
    }
  });

  const handleCreateTeam = () => {
    if (!teamName.trim()) {
      setError('Team name is required');
      return;
    }
    createTeamMutation.mutate({ name: teamName.trim() });
  };

  const handleJoinTeam = () => {
    if (!inviteCode.trim()) {
      setError('Invite code is required');
      return;
    }
    joinTeamMutation.mutate(inviteCode.trim());
  };

  if (!mode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <Users className="h-16 w-16 text-tufts-blue mx-auto mb-4" />
            <h2 className="text-3xl font-extrabold text-gray-900">Welcome to D-Line Manager</h2>
            <p className="mt-2 text-gray-600">Join an existing team or create your own</p>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setMode('join')}
              className="w-full flex items-center justify-center px-6 py-4 border-2 border-gray-300 rounded-lg text-lg font-medium text-gray-900 hover:bg-gray-50"
            >
              <Link className="h-6 w-6 mr-3" />
              Join Existing Team
            </button>

            <button
              onClick={() => setMode('create')}
              className="w-full flex items-center justify-center px-6 py-4 text-white rounded-lg text-lg font-medium hover:opacity-90"
              style={{ backgroundColor: '#3E8EDE' }}
            >
              <Plus className="h-6 w-6 mr-3" />
              Create New Team
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full space-y-8">
          <div>
            <h2 className="text-center text-3xl font-extrabold text-gray-900">
              Create Your Team
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              You'll be able to invite teammates after creating
            </p>
          </div>

          <div className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter team name (e.g., Tufts Ultimate)"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateTeam()}
            />

            <div className="flex space-x-3">
              <button
                onClick={handleCreateTeam}
                disabled={createTeamMutation.isPending}
                className="flex-1 px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90"
                style={{ backgroundColor: '#3E8EDE' }}
              >
                Create Team
              </button>
              <button
                onClick={() => {
                  setMode(null);
                  setError('');
                }}
                className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300"
              >
                Back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="text-center text-3xl font-extrabold text-gray-900">
            Join a Team
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter the invite code from your coach or teammate
          </p>
        </div>

        <div className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <input
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            placeholder="Enter invite code (e.g., ABC123)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl font-mono uppercase"
            maxLength={6}
            onKeyPress={(e) => e.key === 'Enter' && handleJoinTeam()}
          />

          <div className="flex space-x-3">
            <button
              onClick={handleJoinTeam}
              disabled={joinTeamMutation.isPending}
              className="flex-1 px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90"
              style={{ backgroundColor: '#3E8EDE' }}
            >
              Join Team
            </button>
            <button
              onClick={() => {
                setMode(null);
                setError('');
              }}
              className="px-6 py-3 text-gray-700 bg-gray-200 rounded-lg font-medium hover:bg-gray-300"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}