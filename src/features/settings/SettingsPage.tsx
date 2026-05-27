import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import BackButton from '../../components/common/BackButton';
import InstallPrompt from '../../components/common/InstallPrompt';
import { APP_NAME } from '../../lib/constants';
import {
  getMyProfile,
  updateMyProfile,
  type UserProfile,
} from '../../services/profileService';
import { useAuth } from '../auth/useAuth';

function Icon({ path, className = 'h-5 w-5' }: { path: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={path}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
    </svg>
  );
}

interface CachedProfileFields {
  display_name: string | null;
  phone_number: string | null;
}

function getProfileCacheKey(userId: string) {
  return `pantrysync.profile.${userId}`;
}

function readCachedProfile(userId: string | undefined): CachedProfileFields | null {
  if (!userId) {
    return null;
  }

  try {
    const cached = window.localStorage.getItem(getProfileCacheKey(userId));

    return cached ? (JSON.parse(cached) as CachedProfileFields) : null;
  } catch {
    return null;
  }
}

function writeCachedProfile(userId: string, profile: CachedProfileFields) {
  window.localStorage.setItem(getProfileCacheKey(userId), JSON.stringify(profile));
}

export default function SettingsPage() {
  const { signOut, user } = useAuth();
  const navigate = useNavigate();
  const cachedProfile = readCachedProfile(user?.id);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState(
    cachedProfile?.display_name ?? '',
  );
  const [phoneNumber, setPhoneNumber] = useState(
    cachedProfile?.phone_number ?? '',
  );
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const userId = user?.id;

  useEffect(() => {
    let cancelled = false;

    async function loadProfile(activeUserId: string) {
      setProfileError('');

      try {
        const result = await getMyProfile();

        if (!cancelled) {
          setProfile(result);
          setDisplayName(result.display_name ?? '');
          setPhoneNumber(result.phone_number ?? '');
          writeCachedProfile(activeUserId, {
            display_name: result.display_name,
            phone_number: result.phone_number,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setProfileError(
            err instanceof Error ? err.message : 'Could not load profile.',
          );
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    const loadTimer = window.setTimeout(() => {
      const cached = readCachedProfile(userId);

      setDisplayName(cached?.display_name ?? '');
      setPhoneNumber(cached?.phone_number ?? '');
      setProfileSaved(false);
      setIsProfileLoading(true);

      if (!userId) {
        setProfile(null);
        setIsProfileLoading(false);
        return;
      }

      void loadProfile(userId);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(loadTimer);
    };
  }, [userId]);

  async function handleSignOut() {
    setError('');
    setIsSigningOut(true);

    const result = await signOut();

    setIsSigningOut(false);

    if (result.error) {
      setError('Sign out failed. Please try again.');
      return;
    }

    navigate('/login', { replace: true });
  }

  async function handleSaveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    setProfileSaved(false);
    setIsProfileSaving(true);

    try {
      const saved = await updateMyProfile({
        display_name: displayName.trim() || null,
        phone_number: phoneNumber.trim() || null,
      });
      setProfile(saved);
      setDisplayName(saved.display_name ?? '');
      setPhoneNumber(saved.phone_number ?? '');
      if (user) {
        writeCachedProfile(user.id, {
          display_name: saved.display_name,
          phone_number: saved.phone_number,
        });
      }
      setProfileSaved(true);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : 'Could not save profile.',
      );
    } finally {
      setIsProfileSaving(false);
    }
  }

  const settingsItems = [
    {
      label: 'Household members',
      desc: 'View members, invites, and access',
      to: '/app/settings/members',
      icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM17 11h5M19.5 8.5v5',
    },
    {
      label: 'Notification Preferences',
      desc: 'Expiration reminder timing',
      to: '/app/settings/notifications',
      icon: 'M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    },
    {
      label: 'Install App',
      desc: 'Add to your home screen',
      to: null,
      icon: 'M12 3v12m0 0 4-4m-4 4-4-4M5 21h14',
    },
  ];

  return (
    <div className="space-y-5 p-4">
      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-2xl shadow-black/20">
        <BackButton fallback="/app" />
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-300">
              Control center
            </p>
            <h1 className="mt-1 text-3xl font-black text-zinc-100">Settings</h1>
            <p className="text-sm text-zinc-500">
              Household tools, app install, and account controls.
            </p>
          </div>
          <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300 sm:flex">
            <Icon
              className="h-7 w-7"
              path="M4 7h9M17 7h3M4 17h3M11 17h9M7 7a2 2 0 1 0 4 0 2 2 0 0 0-4 0ZM13 17a2 2 0 1 0-4 0 2 2 0 0 0 4 0Z"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {settingsItems.map(({ label, desc, to, icon }) => {
          const content = (
            <>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
                  <Icon path={icon} />
                </span>
                <div className="min-w-0">
                  <p className="font-black text-zinc-100">{label}</p>
                  <p className="text-sm text-zinc-500">{desc}</p>
                </div>
              </div>
              <Icon className="h-5 w-5 shrink-0 text-zinc-500" path="M9 5l7 7-7 7" />
            </>
          );

          return to ? (
            <Link
              key={label}
              className="group flex items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-lg shadow-black/10 transition-all hover:-translate-y-0.5 hover:border-zinc-700"
              to={to}
            >
              {content}
            </Link>
          ) : (
            <div
              key={label}
              className="flex items-center justify-between gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-lg shadow-black/10"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300">
                  <Icon path={icon} />
                </span>
                <div className="min-w-0">
                  <p className="font-black text-zinc-100">{label}</p>
                  <p className="text-sm text-zinc-500">{desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <InstallPrompt alwaysShowInstructions />

      <form
        className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/90 shadow-lg shadow-black/10"
        onSubmit={handleSaveProfile}
      >
        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-300" />
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
              <Icon path="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />
            </span>
            <div>
              <p className="font-black text-zinc-100">Profile</p>
              <p className="text-sm text-zinc-500">
                Choose how your household sees you.
              </p>
            </div>
          </div>

        {profileError ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {profileError}
          </p>
        ) : null}

        {profileSaved ? (
          <p className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            Profile saved.
          </p>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">
              Display name
            </span>
            <input
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isProfileLoading || isProfileSaving}
              maxLength={80}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setProfileSaved(false);
              }}
              placeholder="Your name"
              value={displayName}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-zinc-200">
              Phone number
            </span>
            <input
              autoComplete="tel"
              className="h-12 w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 text-zinc-100 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25"
              disabled={isProfileLoading || isProfileSaving}
              inputMode="tel"
              maxLength={32}
              onChange={(event) => {
                setPhoneNumber(event.target.value);
                setProfileSaved(false);
              }}
              placeholder="+1 555 123 4567"
              value={phoneNumber}
            />
          </label>
        </div>

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 font-semibold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:bg-blue-500/50 md:w-auto"
          disabled={isProfileLoading || isProfileSaving}
          type="submit"
        >
          <Icon path="m5 12 4 4L19 6" />
          {isProfileSaving ? 'Saving...' : 'Save profile'}
        </button>
        </div>
      </form>

      <div className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900/90 p-4 shadow-lg shadow-black/10">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-300">
            <Icon path="M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM4 21a8 8 0 0 1 16 0" />
          </span>
          <div className="min-w-0">
            <p className="font-black text-zinc-100">Signed in</p>
            <p className="truncate text-sm text-zinc-500">
              {profile?.email ?? user?.email ?? 'Current account'}
            </p>
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-zinc-700 px-4 font-semibold text-zinc-100 hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSigningOut}
          onClick={handleSignOut}
          type="button"
        >
          <Icon path="M10 17l5-5-5-5M15 12H3M21 3v18" />
          {isSigningOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-600 pt-4">
        {APP_NAME} v0.1.0
      </p>
    </div>
  );
}
