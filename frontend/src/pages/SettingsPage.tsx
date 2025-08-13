import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Bell, Eye, Globe, Shield, Database } from 'lucide-react';

export default function SettingsPage() {
  const navigate = useNavigate();
  
  // Settings state
  const [notifications, setNotifications] = useState({
    gameUpdates: true,
    teamInvites: true,
    weeklyReports: false,
  });
  
  const [privacy, setPrivacy] = useState({
    publicProfile: false,
    showEmail: false,
    showStats: true,
  });
  
  const [gameDefaults, setGameDefaults] = useState({
    autoSave: true,
    defaultPublic: false,
    showTimer: true,
  });

  const handleSaveSettings = () => {
    // In a real app, this would save to the backend
    localStorage.setItem('appSettings', JSON.stringify({
      notifications,
      privacy,
      gameDefaults
    }));
    alert('Settings saved successfully!');
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
            <h1 className="text-xl font-semibold">Settings</h1>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Notifications */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Bell className="h-5 w-5 mr-2 text-blue-600" />
            Notifications
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div>
                <div className="font-medium text-gray-900">Game Updates</div>
                <div className="text-sm text-gray-500">Receive notifications when games are updated</div>
                <div className="text-xs text-blue-600 mt-1">Coming soon in next update</div>
              </div>
              <input
                type="checkbox"
                checked={notifications.gameUpdates}
                disabled
                className="h-5 w-5 text-gray-400 rounded cursor-not-allowed"
              />
            </label>
            <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div>
                <div className="font-medium text-gray-900">Team Invites</div>
                <div className="text-sm text-gray-500">Get notified when invited to teams</div>
                <div className="text-xs text-blue-600 mt-1">Coming soon in next update</div>
              </div>
              <input
                type="checkbox"
                checked={notifications.teamInvites}
                disabled
                className="h-5 w-5 text-gray-400 rounded cursor-not-allowed"
              />
            </label>
            <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div>
                <div className="font-medium text-gray-900">Weekly Reports</div>
                <div className="text-sm text-gray-500">Receive weekly team performance summaries</div>
                <div className="text-xs text-blue-600 mt-1">Coming soon in next update</div>
              </div>
              <input
                type="checkbox"
                checked={notifications.weeklyReports}
                disabled
                className="h-5 w-5 text-gray-400 rounded cursor-not-allowed"
              />
            </label>
          </div>
        </div>

        {/* Privacy */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Eye className="h-5 w-5 mr-2 text-blue-600" />
            Privacy
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div>
                <div className="font-medium text-gray-900">Public Profile</div>
                <div className="text-sm text-gray-500">Allow anyone to view your profile</div>
                <div className="text-xs text-blue-600 mt-1">Coming soon in next update</div>
              </div>
              <input
                type="checkbox"
                checked={privacy.publicProfile}
                disabled
                className="h-5 w-5 text-gray-400 rounded cursor-not-allowed"
              />
            </label>
            <label className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <div>
                <div className="font-medium text-gray-900">Show Email</div>
                <div className="text-sm text-gray-500">Display email to team members</div>
                <div className="text-xs text-blue-600 mt-1">Coming soon in next update</div>
              </div>
              <input
                type="checkbox"
                checked={privacy.showEmail}
                disabled
                className="h-5 w-5 text-gray-400 rounded cursor-not-allowed"
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Show Statistics</div>
                <div className="text-sm text-gray-500">Display your defensive statistics to team</div>
              </div>
              <input
                type="checkbox"
                checked={privacy.showStats}
                onChange={(e) => setPrivacy({...privacy, showStats: e.target.checked})}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* Game Defaults */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2 text-blue-600" />
            Game Defaults
          </h2>
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Auto-Save</div>
                <div className="text-sm text-gray-500">Automatically save game progress</div>
              </div>
              <input
                type="checkbox"
                checked={gameDefaults.autoSave}
                onChange={(e) => setGameDefaults({...gameDefaults, autoSave: e.target.checked})}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Default Public Games</div>
                <div className="text-sm text-gray-500">Make new games public by default</div>
              </div>
              <input
                type="checkbox"
                checked={gameDefaults.defaultPublic}
                onChange={(e) => setGameDefaults({...gameDefaults, defaultPublic: e.target.checked})}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
            <label className="flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-900">Show Timer</div>
                <div className="text-sm text-gray-500">Display point timer during games</div>
              </div>
              <input
                type="checkbox"
                checked={gameDefaults.showTimer}
                onChange={(e) => setGameDefaults({...gameDefaults, showTimer: e.target.checked})}
                className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>
          </div>
        </div>

        {/* App Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Shield className="h-5 w-5 mr-2 text-blue-600" />
            Application Info
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Version</span>
              <span className="font-medium text-gray-900">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Environment</span>
              <span className="font-medium text-gray-900">Production</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Updated</span>
              <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2 text-blue-600" />
            Data Management
          </h2>
          <div className="space-y-3">
            <button
              disabled
              className="w-full px-4 py-2 text-gray-400 bg-gray-50 rounded-lg cursor-not-allowed text-sm font-medium relative"
            >
              Export Settings
              <span className="text-xs text-blue-600 block mt-1">Coming soon in next update</span>
            </button>
            <button
              onClick={() => {
                localStorage.clear();
                alert('Cache cleared successfully! The app will reload.');
                window.location.reload();
              }}
              className="w-full px-4 py-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 text-sm font-medium"
            >
              Clear Local Cache
            </button>
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          className="w-full px-6 py-3 text-white rounded-lg font-medium hover:opacity-90"
          style={{ backgroundColor: '#3E8EDE' }}
        >
          Save All Settings
        </button>
      </div>
    </div>
  );
}