import { Outlet } from 'react-router-dom';
import { ConfirmDialogProvider } from '../components/common/ConfirmDialog';
import GlobalErrorBoundary from '../components/common/GlobalErrorBoundary';
import { ToastProvider } from '../components/common/ToastProvider';
import { ActiveHouseholdProvider } from '../features/household/ActiveHouseholdProvider';

/**
 * AppProviders wraps all /app/* routes with providers that need the router
 * context (e.g. useNavigate). Sits between ProtectedRoute and page components.
 */
export default function AppProviders() {
  return (
    <ActiveHouseholdProvider>
      <ToastProvider>
        <ConfirmDialogProvider>
          <GlobalErrorBoundary>
            <Outlet />
          </GlobalErrorBoundary>
        </ConfirmDialogProvider>
      </ToastProvider>
    </ActiveHouseholdProvider>
  );
}
