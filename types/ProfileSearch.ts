// types/ProfileSearch.ts - Type definitions matching Android ProfileSearch model

export interface ProfileSearch {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    city?: string;
    state?: string;
    church?: string;
    profilePicture?: string;
    // Additional fields that might be available in API
    biography?: string;
    country?: string;
    zipCode?: string;
    phone?: string;
    address?: string;
    dob?: string;
    gender?: string;
    churchFrom?: string;
    createdTimestamp?: string;
    active?: boolean;
  }
  
  export interface ProfileSearchApiResponse {
    data: ProfileSearch[];
    totalElements?: number;
    totalPages?: number;
    page?: number;
    size?: number;
  }
  
  export interface ProfileSearchParams {
    query?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }
  
  // Utility functions for ProfileSearch
  export class ProfileSearchUtils {
    /**
     * Get full name from profile
     */
    static getFullName(profile: ProfileSearch): string {
      return `${profile.firstName} ${profile.lastName}`.trim();
    }
  
    /**
     * Get display location from profile
     */
    static getLocation(profile: ProfileSearch): string {
      if (profile.city && profile.state) {
        return `${profile.city}, ${profile.state}`;
      }
      if (profile.city) {
        return profile.city;
      }
      if (profile.state) {
        return profile.state;
      }
      return '';
    }
  
    /**
     * Get profile avatar URL or default
     */
    static getAvatarUrl(profile: ProfileSearch, defaultUrl?: string): string {
      return profile.profilePicture || defaultUrl || '';
    }
  
    /**
     * Sort profiles alphabetically by name
     */
    static sortByName(profiles: ProfileSearch[]): ProfileSearch[] {
      return [...profiles].sort((a, b) => {
        const nameA = ProfileSearchUtils.getFullName(a).toLowerCase();
        const nameB = ProfileSearchUtils.getFullName(b).toLowerCase();
        return nameA.localeCompare(nameB);
      });
    }
  
    /**
     * Filter profiles by search query
     */
    static filterProfiles(profiles: ProfileSearch[], query: string): ProfileSearch[] {
      if (!query.trim()) {
        return profiles;
      }
  
      const searchTerm = query.toLowerCase().trim();
      
      return profiles.filter(profile => {
        const fullName = ProfileSearchUtils.getFullName(profile).toLowerCase();
        const city = (profile.city || '').toLowerCase();
        const church = (profile.church || '').toLowerCase();
        const email = (profile.email || '').toLowerCase();
        
        return fullName.includes(searchTerm) ||
               city.includes(searchTerm) ||
               church.includes(searchTerm) ||
               email.includes(searchTerm);
      });
    }
  
    /**
     * Validate profile data
     */
    static isValidProfile(profile: any): profile is ProfileSearch {
      return profile &&
             typeof profile.id === 'string' &&
             typeof profile.firstName === 'string' &&
             typeof profile.lastName === 'string';
    }
  }
  
  export default ProfileSearch;