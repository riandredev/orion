import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Profile {
  id: string;
  name: string;
  color: string;
  theme?: 'dark' | 'light' | 'system';  
}

interface OrganizationState {
  organizationName: string;
  profiles: Profile[];
  activeProfileId: string | null;
  
  setOrganizationName: (name: string) => void;
  addProfile: (profile: Profile) => void;
  updateProfile: (id: string, profile: Partial<Profile>) => void;
  deleteProfile: (id: string) => void;
  setActiveProfile: (id: string | null) => void;
  setProfileTheme: (id: string, theme: 'dark' | 'light' | 'system') => void; 
  getActiveProfile: () => Profile | null; 
}

// Function to generate a random pastel color
export const generatePastelColor = (): string => {
  // Generate a pastel color (high lightness, medium-high saturation)
  const hue = Math.floor(Math.random() * 360);
  const saturation = 60 + Math.floor(Math.random() * 20); // 60-80%
  const lightness = 75 + Math.floor(Math.random() * 15);  // 75-90%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

// Generate a unique ID for profiles
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const useProfileStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      organizationName: 'SDA Panorama',
      profiles: [],
      activeProfileId: null,
      
      setOrganizationName: (name) => set({ organizationName: name }),
      
      addProfile: (profile) => set((state) => {
        const wasEmpty = state.profiles.length === 0;
        const newProfiles = [...state.profiles, profile];
        return {
          profiles: newProfiles,
          activeProfileId: wasEmpty ? profile.id : state.activeProfileId,
        };
      }),
      
      updateProfile: (id, updatedProfile) => set((state) => ({
        profiles: state.profiles.map(profile => 
          profile.id === id ? { ...profile, ...updatedProfile } : profile
        )
      })),
      
      deleteProfile: (id) => set((state) => {
        const newProfiles = state.profiles.filter(profile => profile.id !== id);
        
        // If we're deleting the active profile, set activeProfileId to null
        let newActiveProfileId = state.activeProfileId;
        if (state.activeProfileId === id) {
          newActiveProfileId = newProfiles.length > 0 ? newProfiles[0].id : null;
        }
        
        return {
          profiles: newProfiles,
          activeProfileId: newActiveProfileId
        };
      }),
      
      setActiveProfile: (id) => set((state) => {
        // If only one profile exists, keep it active; do not allow deselecting
        if (id === null && state.profiles.length === 1) {
          return { activeProfileId: state.profiles[0].id };
        }
        return { activeProfileId: id };
      }),

      setProfileTheme: (id, theme) => set((state) => ({
        profiles: state.profiles.map(profile => 
          profile.id === id ? { ...profile, theme } : profile
        )
      })),

      getActiveProfile: () => {
        const { profiles, activeProfileId } = get();
        if (!activeProfileId) return null;
        return profiles.find(profile => profile.id === activeProfileId) || null;
      }
    }),
    {
      name: 'organization-profile-storage',
    }
  )
);
