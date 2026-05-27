import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import ActivityPage from '../features/activity/ActivityPage';
import LoginPage from '../features/auth/LoginPage';
import ProtectedRoute from '../features/auth/ProtectedRoute';
import AcceptInvitePage from '../features/household/AcceptInvitePage';
import HouseholdMembersPage from '../features/household/HouseholdMembersPage';
import InvitePage from '../features/household/InvitePage';
import SignupPage from '../features/auth/SignupPage';
import OnboardingPage from '../features/household/OnboardingPage';
import HomePage from '../features/home/HomePage';
import GroceryPage from '../features/grocery/GroceryPage';
import PantryPage from '../features/pantry/PantryPage';
import PreferencesPage from '../features/notifications/PreferencesPage';
import ScanPage from '../features/scan/ScanPage';
import SettingsPage from '../features/settings/SettingsPage';
import AppProviders from './AppProviders';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/signup',
    element: <SignupPage />,
  },
  {
    path: '/invite/:token',
    element: <AcceptInvitePage />,
  },
  {
    // ProtectedRoute: redirects unauthenticated users to /login
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        // AppProviders: injects router-aware context (ActiveHouseholdProvider)
        element: <AppProviders />,
        children: [
          {
            path: 'onboarding',
            element: <OnboardingPage />,
          },
          {
            element: <AppShell />,
            children: [
              {
                index: true,
                element: <HomePage />,
              },
              {
                path: 'grocery',
                element: <GroceryPage />,
              },
              {
                path: 'activity',
                element: <ActivityPage />,
              },
              {
                path: 'pantry',
                element: <PantryPage />,
              },
              {
                path: 'scan',
                element: <ScanPage />,
              },
              {
                path: 'settings',
                element: <SettingsPage />,
              },
              {
                path: 'settings/notifications',
                element: <PreferencesPage />,
              },
              {
                path: 'settings/invite',
                element: <InvitePage />,
              },
              {
                path: 'settings/members',
                element: <HouseholdMembersPage />,
              },
            ],
          },
        ],
      },
    ],
  },
]);
