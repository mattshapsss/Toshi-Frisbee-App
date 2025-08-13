import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, User, Mail, Shield, Save } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { authApi } from '../lib/api';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');

  const updatePasswordMutation = useMutation({
    mutationFn: authApi.updatePassword,
    onSuccess: () => {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update password');
    }
  });

  const updateUsernameMutation = useMutation({
    mutationFn: authApi.updateUsername,
    onSuccess: (data) => {
      setUser(data.user);
      setIsEditingUsername(false);
      setNewUsername('');
      alert('Username updated successfully!');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Failed to update username');
    }
  });

  const handlePasswordUpdate = () => {
    if (!currentPassword || !newPassword) {
      alert('Please fill in all password fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      alert('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('New password must be at least 6 characters');
      return;
    }

    updatePasswordMutation.mutate({ currentPassword, newPassword });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center text-gray-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            <h1 className="text-xl font-semibold">Profile</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* User Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-blue-600" />
            User Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              {isEditingUsername ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new username"
                  />
                  <button
                    onClick={() => {
                      if (newUsername.trim() && newUsername.trim() !== user?.username) {
                        updateUsernameMutation.mutate({ username: newUsername.trim() });
                      }
                    }}
                    disabled={!newUsername.trim() || updateUsernameMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditingUsername(false);
                      setNewUsername('');
                    }}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-lg">
                  <span className="text-gray-900">{user?.username}</span>
                  <button
                    onClick={() => {
                      setIsEditingUsername(true);
                      setNewUsername(user?.username || '');
                    }}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 flex items-center">
                <Mail className="h-4 w-4 mr-2 text-gray-500" />
                {user?.email}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Member Since</label>
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Change Password
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={handlePasswordUpdate}
              disabled={updatePasswordMutation.isPending}
              className="w-full px-6 py-3 text-white rounded-lg font-medium disabled:bg-gray-300 hover:opacity-90 flex items-center justify-center"
              style={{ backgroundColor: '#3E8EDE' }}
            >
              <Save className="h-5 w-5 mr-2" />
              Update Password
            </button>
          </div>
        </div>

        {/* Account Stats */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Account Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-800">{user?.teams?.length || 0}</div>
              <div className="text-sm text-gray-600">Teams</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-800">Active</div>
              <div className="text-sm text-gray-600">Account Status</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-800">Member</div>
              <div className="text-sm text-gray-600">Account Type</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}