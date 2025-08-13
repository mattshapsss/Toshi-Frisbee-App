import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, teamsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';
import { Users, Shield, Mail, Lock, User, ArrowRight } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { setCurrentTeam } = useTeamStore();
  const [step, setStep] = useState<'role' | 'form' | 'team'>('role');
  const [role, setRole] = useState<'owner' | 'member' | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [teamData, setTeamData] = useState({
    teamName: '',
    inviteCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await authApi.register({
        email: formData.email,
        username: formData.username,
        password: formData.password
      });
      login(response.user, response.accessToken, response.refreshToken);
      
      // Move to team setup step
      setStep('team');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTeamSetup = async () => {
    setError('');
    setLoading(true);

    try {
      if (role === 'owner') {
        // Create a new team
        const team = await teamsApi.create({ 
          name: teamData.teamName 
        });
        setCurrentTeam(team);
        navigate('/');
      } else {
        // Join existing team
        const result = await teamsApi.joinByCode(teamData.inviteCode);
        setCurrentTeam(result.team);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Team setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        {/* Step 1: Choose Role */}
        {step === 'role' && (
          <>
            <div>
              <h2 className="text-center text-3xl font-extrabold text-gray-900">
                Welcome to Ultimate D-Line Manager
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                Are you starting a new team or joining an existing one?
              </p>
            </div>
            
            <div className="space-y-4">
              <button
                onClick={() => {
                  setRole('owner');
                  setStep('form');
                }}
                className="w-full flex items-center justify-between p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center">
                  <Shield className="h-10 w-10 text-blue-600 mr-4" />
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">I'm a Team Owner</h3>
                    <p className="text-sm text-gray-600">I want to create a new team</p>
                  </div>
                </div>
              </button>
              
              <button
                onClick={() => {
                  setRole('member');
                  setStep('form');
                }}
                className="w-full flex items-center justify-between p-6 bg-white border-2 border-gray-200 rounded-lg hover:border-green-500 hover:shadow-md transition-all"
              >
                <div className="flex items-center">
                  <Users className="h-10 w-10 text-green-600 mr-4" />
                  <div className="text-left">
                    <h3 className="text-lg font-semibold text-gray-900">I'm a Team Member</h3>
                    <p className="text-sm text-gray-600">I have an invite code from my team owner</p>
                  </div>
                </div>
              </button>
            </div>
            
            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-medium" style={{ color: '#3E8EDE' }}>
                Sign in
              </Link>
            </p>
          </>
        )}

        {/* Step 2: Registration Form */}
        {step === 'form' && (
          <>
            <div>
              <h2 className="text-center text-3xl font-extrabold text-gray-900">
                Create your account
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {role === 'owner' 
                  ? "You'll create your team after registration"
                  : "You'll join your team after registration"}
              </p>
            </div>
            
            <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <input
                    type="email"
                    required
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tufts-blue focus:border-tufts-blue focus:z-10 sm:text-sm"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div>
                  <input
                    type="text"
                    required
                    pattern="^[a-zA-Z0-9_]+$"
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tufts-blue focus:border-tufts-blue focus:z-10 sm:text-sm"
                    placeholder="Username (letters, numbers, underscore)"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tufts-blue focus:border-tufts-blue focus:z-10 sm:text-sm"
                    placeholder="Password (minimum 8 characters)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
                <div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tufts-blue focus:border-tufts-blue focus:z-10 sm:text-sm"
                    placeholder="Confirm password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: loading ? undefined : '#3E8EDE' }}
                >
                  {loading ? 'Creating account...' : 'Continue'}
                </button>
              </div>
            </form>
          </>
        )}

        {/* Step 3: Team Setup */}
        {step === 'team' && (
          <>
            <div>
              <h2 className="text-center text-3xl font-extrabold text-gray-900">
                {role === 'owner' ? 'Create Your Team' : 'Join Your Team'}
              </h2>
              <p className="mt-2 text-center text-sm text-gray-600">
                {role === 'owner' 
                  ? "Name your team and we'll generate an invite code"
                  : "Enter the 6-character code from your team owner"}
              </p>
            </div>
            
            <div className="mt-8 space-y-6">
              {error && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              
              <div>
                {role === 'owner' ? (
                  <input
                    type="text"
                    required
                    className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-tufts-blue focus:border-tufts-blue focus:z-10 sm:text-sm"
                    placeholder="Team name"
                    value={teamData.teamName}
                    onChange={(e) => setTeamData({ ...teamData, teamName: e.target.value })}
                  />
                ) : (
                  <input
                    type="text"
                    required
                    maxLength={6}
                    className="appearance-none relative block w-full px-6 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 text-center text-2xl font-mono uppercase rounded-md focus:outline-none focus:ring-green-500 focus:border-green-500"
                    placeholder="INVITE CODE"
                    value={teamData.inviteCode}
                    onChange={(e) => setTeamData({ ...teamData, inviteCode: e.target.value.toUpperCase() })}
                  />
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleTeamSetup}
                  disabled={loading || (role === 'owner' ? !teamData.teamName : teamData.inviteCode.length !== 6)}
                  className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{ backgroundColor: loading ? undefined : (role === 'owner' ? '#3E8EDE' : '#10B981') }}
                >
                  {loading ? 'Please wait...' : (role === 'owner' ? 'Create Team' : 'Join Team')}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}