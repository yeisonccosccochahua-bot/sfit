import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useAuthStore } from './stores/authStore';
import { UserRole } from './types';
import { ROLE_REDIRECT } from './lib/constants';

import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './components/layout/MainLayout';
import { CitizenLayout } from './components/layout/CitizenLayout';
import { PageLoader } from './components/ui/spinner';

import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { AdminDashboardPage }  from './pages/admin/AdminDashboardPage';
import { ConfigPage }          from './pages/admin/ConfigPage';
import { UsersManagement }     from './pages/admin/UsersManagement';
import { RoutesManagement }    from './pages/admin/RoutesManagement';
import { AuditLogPage }        from './pages/admin/AuditLogPage';
import { CompaniesManagement } from './pages/admin/CompaniesManagement';
import { CompanyDetailPage }   from './pages/admin/CompanyDetailPage';
import { DriversManagement }   from './pages/admin/DriversManagement';
import { VehiclesManagement }  from './pages/admin/VehiclesManagement';
import { FiscalDashboardPage }        from './pages/dashboard/FiscalDashboardPage';
import { SanctionsPage }              from './pages/dashboard/SanctionsPage';
import { DriversPage }                from './pages/dashboard/DriversPage';
import { ReportsManagementPage }      from './pages/dashboard/ReportsManagementPage';
import { FiscalRoutesManagementPage } from './pages/dashboard/RoutesManagementPage';
import { CompaniesPage }              from './pages/dashboard/CompaniesPage';
import { AnalyticsPage }              from './pages/dashboard/AnalyticsPage';
import { OperatorDashboard } from './pages/operator/OperatorDashboard';
import { TripRegistrationPage } from './pages/operator/TripRegistrationPage';
import { TripsListPage } from './pages/operator/TripsListPage';
import { TripSchedulerPage } from './pages/operator/TripSchedulerPage';

import { CitizenPage } from './pages/citizen/CitizenPage';
import { QrScanPage } from './pages/citizen/QrScanPage';
import { TripViewPage } from './pages/citizen/TripViewPage';
import { ReportFormPage } from './pages/citizen/ReportFormPage';
import { CitizenProfile } from './pages/citizen/CitizenProfile';
import { CitizenRanking } from './pages/citizen/CitizenRanking';
import { MyReportsPage } from './pages/citizen/MyReportsPage';

import { InspectorDashboard }      from './pages/inspector/InspectorDashboard';
import { InspectorScanPage }       from './pages/inspector/InspectorScanPage';
import { InspectorScanResultPage } from './pages/inspector/InspectorScanResultPage';
import { InspectionsHistoryPage }  from './pages/inspector/InspectionsHistoryPage';
import { InspectionFormPage }      from './pages/inspector/InspectionFormPage';
import { InspectionDetailPage }    from './pages/inspector/InspectionDetailPage';
import { ActiveTripsPage }         from './pages/inspector/ActiveTripsPage';
import { DriverLookupPage }        from './pages/inspector/DriverLookupPage';
import { VehicleLookupPage }       from './pages/inspector/VehicleLookupPage';
import { InspectorStatsPage }      from './pages/inspector/InspectorStatsPage';
import { ScanResultPage } from './pages/public/ScanResultPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ForbiddenPage } from './pages/ForbiddenPage';

function RootRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={ROLE_REDIRECT[user.role]} replace />;
}

function AppBootstrap({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuth();
  const { isLoading } = useAuthStore();

  useEffect(() => { checkAuth(); }, []);

  if (isLoading) return <PageLoader />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppBootstrap>
        <Routes>
          {/* Public */}
          <Route path="/login"            element={<LoginPage />} />
          <Route path="/register"         element={<RegisterPage />} />
          <Route path="/forbidden"        element={<ForbiddenPage />} />
          <Route path="/scan/:qrCode"     element={<ScanResultPage />} />

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.ADMIN_MUNICIPAL]} />}>
            <Route element={<MainLayout />}>
              <Route path="/admin"           element={<AdminDashboardPage />} />
              <Route path="/admin/config"    element={<ConfigPage />} />
              <Route path="/admin/users"     element={<UsersManagement />} />
              <Route path="/admin/routes"    element={<RoutesManagement />} />
              <Route path="/admin/audit"     element={<AuditLogPage />} />
              <Route path="/admin/companies"          element={<CompaniesManagement />} />
              <Route path="/admin/companies/:id"      element={<CompanyDetailPage />} />
              <Route path="/admin/drivers"            element={<DriversManagement />} />
              <Route path="/admin/vehicles"           element={<VehiclesManagement />} />
            </Route>
          </Route>

          {/* Fiscal */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.FISCAL]} />}>
            <Route element={<MainLayout />}>
              <Route path="/dashboard"              element={<FiscalDashboardPage />} />
              <Route path="/dashboard/sanctions"    element={<SanctionsPage />} />
              <Route path="/dashboard/drivers"      element={<DriversPage />} />
              <Route path="/dashboard/reports"      element={<ReportsManagementPage />} />
              <Route path="/dashboard/routes"       element={<FiscalRoutesManagementPage />} />
              <Route path="/dashboard/companies"    element={<CompaniesPage />} />
              <Route path="/dashboard/analytics"    element={<AnalyticsPage />} />
            </Route>
          </Route>

          {/* Operator */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.OPERADOR_EMPRESA]} />}>
            <Route element={<MainLayout />}>
              <Route path="/operator"              element={<OperatorDashboard />} />
              <Route path="/operator/schedule"     element={<TripSchedulerPage />} />
              <Route path="/operator/trips"         element={<TripsListPage />} />
              <Route path="/operator/trips/new"     element={<TripRegistrationPage />} />
              <Route path="/operator/drivers"       element={<DriversManagement />} />
              <Route path="/operator/vehicles"      element={<VehiclesManagement />} />
            </Route>
          </Route>

          {/* Citizen — mobile PWA layout with bottom tabs */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.CIUDADANO]} />}>
            <Route element={<CitizenLayout />}>
              <Route path="/citizen"                    element={<CitizenPage />} />
              <Route path="/citizen/scan"               element={<QrScanPage />} />
              <Route path="/citizen/trip/:tripId"       element={<TripViewPage />} />
              <Route path="/citizen/report/:tripId"     element={<ReportFormPage />} />
              <Route path="/citizen/reports"            element={<MyReportsPage />} />
              <Route path="/citizen/profile"            element={<CitizenProfile />} />
              <Route path="/citizen/ranking"            element={<CitizenRanking />} />
            </Route>
          </Route>

          {/* Inspector */}
          <Route element={<ProtectedRoute allowedRoles={[UserRole.INSPECTOR]} />}>
            <Route element={<MainLayout />}>
              <Route path="/inspector"                          element={<InspectorDashboard />} />
              <Route path="/inspector/scan"                     element={<InspectorScanPage />} />
              <Route path="/inspector/scan/result/:inspectionId" element={<InspectorScanResultPage />} />
              <Route path="/inspector/inspections"              element={<InspectionsHistoryPage />} />
              <Route path="/inspector/inspections/new"          element={<InspectionFormPage />} />
              <Route path="/inspector/inspections/:id"          element={<InspectionDetailPage />} />
              <Route path="/inspector/viajes-activos"           element={<ActiveTripsPage />} />
              <Route path="/inspector/lookup/driver"            element={<DriverLookupPage />} />
              <Route path="/inspector/lookup/vehicle"           element={<VehicleLookupPage />} />
              <Route path="/inspector/stats"                    element={<InspectorStatsPage />} />
            </Route>
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppBootstrap>
    </BrowserRouter>
  );
}
