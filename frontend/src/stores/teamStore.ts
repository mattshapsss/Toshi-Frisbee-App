import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Team {
  id: string;
  name: string;
  slug: string;
  inviteCode: string;
  role: string;
  description?: string;
  _count?: {
    members: number;
    defenders: number;
    games: number;
  };
}

interface TeamStore {
  currentTeam: Team | null;
  teams: Team[];
  setCurrentTeam: (team: Team | null) => void;
  setTeams: (teams: Team[]) => void;
  clearTeam: () => void;
}

export const useTeamStore = create<TeamStore>()(
  persist(
    (set) => ({
      currentTeam: null,
      teams: [],
      setCurrentTeam: (team) => set({ currentTeam: team }),
      setTeams: (teams) => set({ teams }),
      clearTeam: () => set({ currentTeam: null, teams: [] }),
    }),
    {
      name: 'team-storage',
    }
  )
);