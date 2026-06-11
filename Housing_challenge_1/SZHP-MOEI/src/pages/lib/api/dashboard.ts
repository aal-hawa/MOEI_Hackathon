import { authFetch } from '@/lib/utils'
import type { DashboardStats } from '@/lib/store'

/**
 * Fetch admin dashboard statistics including status distribution,
 * risk distribution, monthly trend, and recent requests.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await authFetch('/api/dashboard')
  if (!res.ok) {
    throw new Error(`Failed to fetch dashboard stats: ${res.status}`)
  }
  const data = await res.json()
  return data as DashboardStats
}
