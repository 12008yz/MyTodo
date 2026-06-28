import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../features/auth/AuthProvider";
import { HARSHNESS_OPTIONS } from "../../features/onboarding/constants";
import { useProfileTodayStats } from "../../features/profile/useProfileTodayStats";
import { EditNameModal } from "../../components/profile/EditNameModal";
import {
  BellIcon,
  BookIcon,
  CardIcon,
  ClockIcon,
  HelpIcon,
  InfoIcon,
  KeyIcon,
  LogoutIcon,
  SettingsIcon,
  ShieldIcon,
  SunIcon,
  UserIcon,
} from "../../components/profile/ProfileIcons";
import { ProfileMenuRow } from "../../components/profile/ProfileMenuRow";
import { ProfileMenuSection } from "../../components/profile/ProfileMenuSection";
import { isDemoMode } from "../../lib/demo-mode";
import { getEnglishToday } from "../../lib/api";
import { englishQueryKeys } from "../../features/english/useEnglish";
import { requestPushSubscription } from "../../lib/push";
import "./ProfilePage.css";

function getUserInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

function comingSoon() {
  // Placeholder until sub-screens are implemented.
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const { pending, completed, isLoading } = useProfileTodayStats();
  const { data: englishToday } = useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
  });
  const [editNameOpen, setEditNameOpen] = useState(false);

  const englishHint =
    englishToday?.enabled === true
      ? `День ${englishToday.current_day}`
      : "Начать курс";

  if (!user) {
    return <p className="home__placeholder">Загрузка профиля…</p>;
  }

  const harshness = HARSHNESS_OPTIONS.find((option) => option.level === user.harshness_level);
  const scheduleHint =
    user.wake_time && user.sleep_time
      ? `${formatTime(user.wake_time)} – ${formatTime(user.sleep_time)}`
      : "Не задано";

  return (
    <div className="profile-page">
      <h1 className="profile-page__title">Профиль</h1>

      <div className="profile-page__hero">
        <div className="profile-page__avatar" aria-hidden="true">
          {getUserInitial(user.name)}
        </div>
        <p className="profile-page__name">{user.name}</p>
      </div>

      <div className="profile-page__stats">
        <div className="profile-page__stat">
          {isLoading ? "…" : `${pending} осталось`}
        </div>
        <div className="profile-page__stat">
          {isLoading ? "…" : `${completed} выполнено`}
        </div>
      </div>

      {isDemoMode() ? (
        <p className="home__demo-banner" role="status">
          Демо-режим — настройки сохраняются локально.
        </p>
      ) : null}

      <ProfileMenuSection title="Настройки">
        <ProfileMenuRow
          icon={<SettingsIcon />}
          label="Настройки приложения"
          hint="Помодоро, уведомления"
          onClick={comingSoon}
        />
        <ProfileMenuRow
          icon={<BellIcon />}
          label="Уведомления"
          onClick={() => void requestPushSubscription()}
        />
        <ProfileMenuRow
          icon={<ClockIcon />}
          label="Помодоро"
          hint={`${user.pomodoro_work_min} / ${user.pomodoro_break_min} мин`}
          onClick={comingSoon}
        />
        <ProfileMenuRow
          icon={<SettingsIcon />}
          label="Жёсткость наставника"
          hint={harshness ? `${harshness.emoji} ${harshness.title}` : undefined}
          onClick={comingSoon}
        />
      </ProfileMenuSection>

      <ProfileMenuSection title="Аккаунт">
        <ProfileMenuRow
          icon={<UserIcon />}
          label="Изменить имя"
          onClick={() => setEditNameOpen(true)}
        />
        <ProfileMenuRow icon={<KeyIcon />} label="Сменить пароль" hint="Скоро" disabled />
        <ProfileMenuRow
          icon={<SunIcon />}
          label="Режим дня"
          hint={scheduleHint}
          onClick={comingSoon}
        />
      </ProfileMenuSection>

      <ProfileMenuSection title="Новая глава">
        <ProfileMenuRow
          icon={<BookIcon />}
          label="Английский"
          hint={englishHint}
          onClick={() => navigate("/english")}
        />
        <ProfileMenuRow icon={<ShieldIcon />} label="Залог" hint="5000 ₽ · скоро" disabled />
        <ProfileMenuRow icon={<CardIcon />} label="Подписка" hint="Скоро" disabled />
      </ProfileMenuSection>

      <ProfileMenuSection title="О приложении">
        <ProfileMenuRow icon={<InfoIcon />} label="О нас" onClick={comingSoon} />
        <ProfileMenuRow icon={<InfoIcon />} label="FAQ" onClick={comingSoon} />
        <ProfileMenuRow icon={<HelpIcon />} label="Помощь и обратная связь" onClick={comingSoon} />
      </ProfileMenuSection>

      <div className="profile-page__logout-wrap">
        <ProfileMenuRow
          icon={<LogoutIcon />}
          label="Выйти"
          danger
          showChevron={false}
          onClick={() => void logout()}
        />
      </div>

      <EditNameModal
        open={editNameOpen}
        initialName={user.name}
        onClose={() => setEditNameOpen(false)}
        onSave={async (name) => {
          await updateProfile({ name });
        }}
      />
    </div>
  );
}
