import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ChevronDown, LogOut, Users, User, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useTeamStore } from '../stores/teamStore';

export default function ProfileDropdown() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const { currentTeam, teams, setCurrentTeam } = useTeamStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleTeamSwitch = (team: any) => {
    setCurrentTeam(team);
    setIsOpen(false);
    // Invalidate all queries to refresh data for new team
    queryClient.invalidateQueries();
    // Navigate to home to show new team data
    navigate('/');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 text-white hover:text-gray-200 transition-colors"
      >
        <div className="text-right">
          <div className="text-sm font-medium">{user?.username}</div>
        </div>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-1 z-50">
          {/* User info */}
          <div className="px-4 py-2 border-b border-gray-200">
            <div className="font-medium text-gray-900">{user?.username}</div>
            <div className="text-sm text-gray-500">{user?.email}</div>
          </div>

          {/* Current team */}
          {currentTeam && (
            <div className="px-4 py-2 border-b border-gray-200 bg-blue-50">
              <div className="text-xs text-gray-600 mb-1">Current Team</div>
              <div className="font-medium text-gray-900">{currentTeam.name}</div>
              <div className="text-xs text-blue-600">{currentTeam.role}</div>
            </div>
          )}

          {/* Team switcher */}
          {teams.length > 1 && (
            <div className="border-b border-gray-200">
              <div className="px-4 py-2 text-xs text-gray-600">Switch Team</div>
              {teams
                .filter(team => team.id !== currentTeam?.id)
                .map(team => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSwitch(team)}
                    className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center justify-between"
                  >
                    <span className="text-sm text-gray-700">{team.name}</span>
                    <span className="text-xs text-gray-500">{team.role}</span>
                  </button>
                ))}
            </div>
          )}

          {/* Menu items */}
          <button
            onClick={() => {
              navigate('/teams');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
          >
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">Manage Teams</span>
          </button>

          <button
            onClick={() => {
              navigate('/profile');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
          >
            <User className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">Profile</span>
          </button>

          <button
            onClick={() => {
              navigate('/settings');
              setIsOpen(false);
            }}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
          >
            <Settings className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-700">Settings</span>
          </button>

          <div className="border-t border-gray-200 mt-1">
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4 text-red-500" />
              <span className="text-sm text-red-600">Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}