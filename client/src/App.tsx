import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RouteTranslator } from "@/components/ui/RouteTranslator";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import VehicleRegistrationPage from "@/pages/vehicle-registration-page";
import VehiclesPage from "@/pages/vehicles-page";
import ProfilePage from "@/pages/profile-page";
import PassengerProfilePage from "@/pages/passenger-profile-page";
import PassengerRideHistoryPage from "@/pages/passenger-ride-history-page";
import PassengerCurrentRidePage from "@/pages/passenger-current-ride-page";
import PassengerPaymentsPage from "@/pages/passenger-payments-page";
import PassengerAddressesPage from "@/pages/passenger-addresses-page";
import PassengerReceiptsPage from "@/pages/passenger-receipts-page";
import PassengerSupportPage from "@/pages/passenger-support-page";
import PassengerWalletPage from "@/pages/passenger-wallet-page";
import RideHistoryPage from "@/pages/ride-history-page";
import WithdrawalPage from "@/pages/withdrawal-page";
import LandingPage from "@/pages/landing-page";
import EmergencyContactsPage from "@/pages/emergency-contacts-page";
import PassengerRegistrationPage from "@/pages/passenger-registration-page";
import PassengerDashboardPage from "@/pages/passenger-dashboard-page";
import MapDemoPage from "@/pages/map-demo-page";
import AdminPage from "@/pages/admin-page";
import NotificationsPage from "@/pages/admin/notifications-page";
import PricingPage from "@/pages/admin/pricing-page";
import DriversPage from "@/pages/admin/drivers-page";
import PassengersPage from "@/pages/admin/passengers-page";
import SupportPage from "@/pages/admin/support-page";
import PayoutsPage from "@/pages/admin/payouts-page";
import MapPage from "@/pages/admin/map-page";
import CitiesPage from "@/pages/admin/cities-page";
import CorporatePlansPage from "@/pages/admin/corporate-plans-page";
import TollManagementPage from "@/pages/admin/toll-management-page";
import PricingAlgorithmPage from "@/pages/admin/pricing-algorithm-page";
import ConfigManagementPage from "@/pages/admin/config-management-page";
import AsaasTestPage from "@/pages/admin/asaas-test-page";
import PassengerDeliveryPage from "@/pages/passenger-delivery-page";
import TransportTypePage from "@/pages/transport-type-page";
import RideTrackingDemo from "@/pages/ride-tracking-demo";
import PartnersPage from "@/pages/partners-page";
import SuperAdminLogin from "@/pages/superadmin-login";
// SuperAdminPage removido - usando AdminPage como SuperAdmin
import InvestorsPage from "@/pages/investors-page";
import CouponsPage from "@/pages/admin/coupons-page";
import FinancialPage from "@/pages/admin/financial-page";
import CollectionPointsPage from "@/pages/admin/collection-points-page";
import FeatureTogglesPage from "@/pages/admin/feature-toggles-page";
import AdminInvestorsPage from "@/pages/admin/investors-page";
import AdminPartnersPage from "@/pages/admin/partners-page";
import AdminLoginPage from "@/pages/admin-login-page";
import { CrlvSchedulePage } from "@/pages/admin/crlv-schedule";
import { EcoPage } from "@/pages/eco-page";
import DriverRideRequestsPage from "@/pages/driver-ride-requests";
import TooltipTestPage from "@/pages/tooltip-test-page";
import TestRideRequestPage from "@/pages/test-ride-request";
import { ProtectedRoute } from "@/lib/protected-route";
import { LanguageProvider } from "@/hooks/use-language";
import { AuthProvider } from "@/hooks/use-auth";
import { EmergencyContactsProvider } from "@/hooks/use-emergency-contacts";
import { GoogleMapsProvider } from "@/components/maps/GoogleMapsProvider";
import { RealTimeProvider } from "@/hooks/use-real-time";

function Router() {
  return (
    <Switch>
      {/* Rotas públicas */}
      <Route path="/" component={LandingPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/passenger/register" component={PassengerRegistrationPage} />
      <Route path="/driver/register" component={AuthPage} />
      <Route path="/partners" component={PartnersPage} />
      <Route path="/investors" component={InvestorsPage} />
      <Route path="/admin-login" component={AdminLoginPage} />
      <Route path="/superadmin-login" component={SuperAdminLogin} />
      
      {/* Rotas de motorista */}
      <ProtectedRoute 
        path="/dashboard" 
        component={DashboardPage} 
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/vehicle/register" 
        component={VehicleRegistrationPage} 
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/vehicles" 
        component={VehiclesPage} 
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/profile" 
        component={ProfilePage}
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/ride-history" 
        component={RideHistoryPage} 
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/withdrawal" 
        component={WithdrawalPage} 
        requiredUserType="driver" 
      />
      <ProtectedRoute 
        path="/emergency-contacts" 
        component={EmergencyContactsPage} 
        requiredUserType={['driver', 'passenger']}
      />
      <ProtectedRoute 
        path="/eco" 
        component={EcoPage} 
        requiredUserType={['driver', 'passenger']}
      />
      <ProtectedRoute 
        path="/driver/ride-requests" 
        component={DriverRideRequestsPage} 
        requiredUserType="driver" 
      />
      
      {/* Rotas de passageiro */}
      <ProtectedRoute 
        path="/transport-type" 
        component={TransportTypePage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger-dashboard" 
        component={PassengerDashboardPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/profile" 
        component={PassengerProfilePage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/ride-history" 
        component={PassengerRideHistoryPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/current-ride" 
        component={PassengerCurrentRidePage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/wallet" 
        component={PassengerWalletPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/payments" 
        component={PassengerPaymentsPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/addresses" 
        component={PassengerAddressesPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/receipts" 
        component={PassengerReceiptsPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/support" 
        component={PassengerSupportPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/delivery" 
        component={PassengerDeliveryPage} 
        requiredUserType="passenger" 
      />
      <ProtectedRoute 
        path="/passenger/emergency-contacts" 
        component={EmergencyContactsPage} 
        requiredUserType="passenger" 
      />
      
      {/* Rota de teste para solicitação de corridas */}
      <ProtectedRoute 
        path="/test-ride" 
        component={TestRideRequestPage} 
        requiredUserType={["passenger", "driver", "admin"]}
      />
      
      {/* Rotas de administrador */}
      <ProtectedRoute 
        path="/admin" 
        component={AdminPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/notifications" 
        component={NotificationsPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/pricing" 
        component={PricingPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/drivers" 
        component={DriversPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/crlv-schedule" 
        component={CrlvSchedulePage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/passengers" 
        component={PassengersPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/support" 
        component={SupportPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/payouts" 
        component={PayoutsPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/map" 
        component={MapPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/cities" 
        component={CitiesPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/corporate-plans" 
        component={CorporatePlansPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/toll-management" 
        component={TollManagementPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/pricing-algorithm" 
        component={PricingAlgorithmPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/config-management" 
        component={ConfigManagementPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/asaas-test" 
        component={AsaasTestPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/coupons" 
        component={CouponsPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/financial" 
        component={FinancialPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/investors" 
        component={AdminInvestorsPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/partners" 
        component={AdminPartnersPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/collection-points" 
        component={CollectionPointsPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      <ProtectedRoute 
        path="/admin/feature-toggles" 
        component={FeatureTogglesPage} 
        requiredUserType={['admin', 'superadmin']}
      />
      
      {/* Rotas Super Admin */}
      <ProtectedRoute 
        path="/superadmin" 
        component={AdminPage} 
        requiredUserType="superadmin" 
      />
      
      {/* Rotas de teste/demo */}
      <Route path="/map-demo" component={MapDemoPage} />
      <Route path="/ride-tracking-demo" component={RideTrackingDemo} />
      <Route path="/tooltip-test" component={TooltipTestPage} />
      
      {/* Página não encontrada */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <RealTimeProvider>
            <EmergencyContactsProvider>
              <GoogleMapsProvider>
                <TooltipProvider delayDuration={300} skipDelayDuration={100}>
                  <Toaster />
                  <Router />
                  {/* Comentado temporariamente para resolver problemas */}
                  {/* <RouteTranslator /> */}
                </TooltipProvider>
              </GoogleMapsProvider>
            </EmergencyContactsProvider>
          </RealTimeProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
