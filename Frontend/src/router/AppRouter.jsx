import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import ProtectedRoute from '@/components/routing/ProtectedRoute'
import GuestRoute from '@/components/routing/GuestRoute'
import AdminRoute from '@/components/routing/AdminRoute'
import SessionBootstrap from '@/components/routing/SessionBootstrap'
import { ROUTES } from '@/constants/routes'

const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'))
const ClustersPage = lazy(() => import('@/pages/ClustersPage'))
const AdminDashboardPage = lazy(() => import('@/pages/AdminDashboardPage'))
const GraphPage = lazy(() => import('@/pages/GraphPage'))
const ItemDetailPage = lazy(() => import('@/pages/ItemDetailPage'))
const ResurfacingPage = lazy(() => import('@/pages/ResurfacingPage'))
const LoginPage = lazy(() => import('@/pages/LoginPage'))
const RegisterPage = lazy(() => import('@/pages/RegisterPage'))
const OAuthSuccessPage = lazy(() => import('@/pages/OAuthSuccessPage'))
const OAuthErrorPage = lazy(() => import('@/pages/OAuthErrorPage'))
const SharedItemPage = lazy(() => import('@/pages/SharedItemPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))
const UiLabPage = lazy(() => import('@/pages/UiLabPage'))

function RouteFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-sm text-text-secondary">
      Loading page...
    </div>
  )
}

export function AppRouter() {
  return (
    <SessionBootstrap>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path={ROUTES.LOGIN}
            element={
              <GuestRoute>
                <LoginPage />
              </GuestRoute>
            }
          />
          <Route
            path={ROUTES.REGISTER}
            element={
              <GuestRoute>
                <RegisterPage />
              </GuestRoute>
            }
          />
          <Route path={ROUTES.AUTH_OAUTH_SUCCESS} element={<OAuthSuccessPage />} />
          <Route path={ROUTES.AUTH_OAUTH_ERROR} element={<OAuthErrorPage />} />
          <Route path={ROUTES.SHARED_ITEM} element={<SharedItemPage />} />
          <Route path="/ui-lab" element={<UiLabPage />} />

          <Route
            path={ROUTES.ROOT}
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to={ROUTES.DASHBOARD} replace />} />
            <Route path={ROUTES.DASHBOARD.slice(1)} element={<DashboardPage />} />
            <Route path={ROUTES.SEARCH.slice(1)} element={<SearchPage />} />
            <Route path={ROUTES.COLLECTIONS.slice(1)} element={<CollectionsPage />} />
            <Route path={ROUTES.CLUSTERS.slice(1)} element={<ClustersPage />} />
            <Route
              path={ROUTES.ADMIN.slice(1)}
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
            <Route path={ROUTES.GRAPH.slice(1)} element={<GraphPage />} />
            <Route path={ROUTES.ITEM_DETAIL.slice(1)} element={<ItemDetailPage />} />
            <Route path={ROUTES.RESURFACING.slice(1)} element={<ResurfacingPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </SessionBootstrap>
  )
}

export default AppRouter
