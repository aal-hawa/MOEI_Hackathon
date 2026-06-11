import React, { Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { LanguageSync } from '@/components/providers/language-sync'
import { PageLoader } from '@/components/shared'
import { CustomerChatbot } from '@/components/shared'

/** Conditionally renders CustomerChatbot only on customer-facing routes (hides on /admin). */
function CustomerChatbotGuard() {
  const location = useLocation()
  const isAdminRoute = location.pathname.startsWith('/admin')
  if (isAdminRoute) return null
  return <CustomerChatbot />
}

// Route pages - lazy loaded
const LandingPage = React.lazy(() => import('@/routes/index'))
const AdminPage = React.lazy(() => import('@/routes/admin'))
const AdminLoginPage = React.lazy(() => import('@/routes/admin-login'))
const NewRequestPage = React.lazy(() => import('@/routes/new-request'))
const MyRequestsPage = React.lazy(() => import('@/routes/my-requests'))

// Create a react-query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
})

// Simple Theme Provider (replaces next-themes)
function ThemeProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Always use light mode - remove dark class if present
    document.documentElement.classList.remove('dark')
    localStorage.setItem('szhp-theme', 'light')
  }, [])

  return <>{children}</>
}

// PageLoader is imported from @/components/shared

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <LanguageSync />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/new-request" element={<NewRequestPage />} />
              <Route path="/my-requests" element={<MyRequestsPage />} />
            </Routes>
          </Suspense>
          <Toaster />
          <CustomerChatbotGuard />
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
