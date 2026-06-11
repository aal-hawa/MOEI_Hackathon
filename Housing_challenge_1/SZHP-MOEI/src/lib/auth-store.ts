'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UAEPassUserProfile, MockUserProfile } from './uaepass-mock'

export type UserRole = 'citizen' | 'employee' | 'admin' | 'superadmin' | 'reviewer' | 'manager'
export type PortalType = 'login' | 'customer' | 'admin'

export interface AuthState {
  isAuthenticated: boolean
  authMode: 'mock' | 'production'
  userProfile: UAEPassUserProfile | null
  userRole: UserRole
  currentPortal: PortalType
  accessToken: string | null
  selectedMockUserId: string | null
  mockExtraData: MockUserProfile | null
  permissions: string[]
  _hasHydrated: boolean

  // Actions
  loginWithMockUser: (profile: MockUserProfile) => Promise<void>
  loginWithRandomMock: (profile: MockUserProfile) => Promise<void>
  loginWithProduction: (profile: UAEPassUserProfile, role: UserRole, token: string) => void
  loginWithAdminCredentials: (data: {
    user: {
      id: string
      email: string
      firstnameEN: string
      lastnameEN: string
      firstnameAR?: string
      lastnameAR?: string
      role: string
      department?: string
      permissions?: string[]
    }
    accessToken: string
  }) => void
  logout: () => void
  setCurrentPortal: (portal: PortalType) => void
  setAuthMode: (mode: 'mock' | 'production') => void
  getUserName: (lang?: 'en' | 'ar') => string
  setHasHydrated: (state: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      authMode: 'mock',
      userProfile: null,
      userRole: 'citizen',
      currentPortal: 'login',
      accessToken: null,
      selectedMockUserId: null,
      mockExtraData: null,
      permissions: [],
      _hasHydrated: false,

      loginWithMockUser: async (profile: MockUserProfile) => {
        const { role, department, monthlyIncome, employer, employerType, familySize, hasActiveLoan, ...uaepassProfile } = profile

        // Call server to create a real DB session so authFetch works
        let serverToken: string | null = null
        try {
          const res = await fetch('/api/auth/mock-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile, authMode: 'mock' }),
          })
          if (res.ok) {
            const data = await res.json()
            serverToken = data.accessToken || null
          }
        } catch {
          // Fallback: if server session creation fails, use client-side token
          console.warn('Mock login server session creation failed, using fallback token')
        }

        set({
          isAuthenticated: true,
          authMode: 'mock',
          userProfile: uaepassProfile,
          userRole: role,
          currentPortal: role === 'citizen' ? 'customer' : 'admin',
          accessToken: serverToken || `mock_token_${profile.sub}`,
          selectedMockUserId: profile.sub,
          mockExtraData: profile,
          permissions: [],
        })
      },

      loginWithRandomMock: async (profile: MockUserProfile) => {
        const { role, department, monthlyIncome, employer, employerType, familySize, hasActiveLoan, ...uaepassProfile } = profile

        // Call server to create a real DB session so authFetch works
        let serverToken: string | null = null
        try {
          const res = await fetch('/api/auth/mock-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile, authMode: 'mock' }),
          })
          if (res.ok) {
            const data = await res.json()
            serverToken = data.accessToken || null
          }
        } catch {
          console.warn('Mock login server session creation failed, using fallback token')
        }

        set({
          isAuthenticated: true,
          authMode: 'mock',
          userProfile: uaepassProfile,
          userRole: role,
          currentPortal: role === 'citizen' ? 'customer' : 'admin',
          accessToken: serverToken || `mock_token_${profile.sub}`,
          selectedMockUserId: null,
          mockExtraData: profile,
          permissions: [],
        })
      },

      loginWithProduction: (profile: UAEPassUserProfile, role: UserRole, token: string) => {
        set({
          isAuthenticated: true,
          authMode: 'production',
          userProfile: profile,
          userRole: role,
          currentPortal: role === 'citizen' ? 'customer' : 'admin',
          accessToken: token,
          selectedMockUserId: null,
          mockExtraData: null,
          permissions: [],
        })
      },

      loginWithAdminCredentials: (data) => {
        const { user, accessToken } = data
        // Map admin user to UAEPassUserProfile format
        const mappedProfile: UAEPassUserProfile = {
          sub: user.id,
          firstnameEN: user.firstnameEN,
          lastnameEN: user.lastnameEN,
          firstnameAR: user.firstnameAR || '',
          lastnameAR: user.lastnameAR || '',
          fullnameEN: `${user.firstnameEN} ${user.lastnameEN}`,
          fullnameAR: user.firstnameAR && user.lastnameAR ? `${user.firstnameAR} ${user.lastnameAR}` : '',
          email: user.email,
          mobile: '',
          idn: '',
          nationalityEN: '',
          nationalityAR: '',
          gender: '',
          dob: '',
          sopLevel: 'sop3',
          exp: Math.floor(Date.now() / 1000) + 86400,
        }
        const mappedRole = user.role as UserRole
        set({
          isAuthenticated: true,
          authMode: 'mock',
          userProfile: mappedProfile,
          userRole: mappedRole,
          currentPortal: 'admin',
          accessToken: accessToken,
          selectedMockUserId: user.id,
          mockExtraData: null,
          permissions: user.permissions || [],
        })
      },

      logout: () => {
        set({
          isAuthenticated: false,
          userProfile: null,
          userRole: 'citizen',
          currentPortal: 'login',
          accessToken: null,
          selectedMockUserId: null,
          mockExtraData: null,
          permissions: [],
        })
      },

      setCurrentPortal: (portal: PortalType) => {
        set({ currentPortal: portal })
      },

      setAuthMode: (mode: 'mock' | 'production') => {
        set({ authMode: mode })
      },

      getUserName: (lang: 'en' | 'ar' = 'en') => {
        const profile = get().userProfile
        if (!profile) return ''
        return lang === 'ar' && profile.fullnameAR ? profile.fullnameAR : profile.fullnameEN
      },

      setHasHydrated: (state: boolean) => {
        set({ _hasHydrated: state })
      },
    }),
    {
      name: 'szhp-auth-storage',
      storage: createJSONStorage(() => {
        // Fallback for SSR
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          } as any
        }
        return sessionStorage
      }),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        authMode: state.authMode,
        userProfile: state.userProfile,
        userRole: state.userRole,
        currentPortal: state.currentPortal,
        accessToken: state.accessToken,
        selectedMockUserId: state.selectedMockUserId,
        mockExtraData: state.mockExtraData,
        permissions: state.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
