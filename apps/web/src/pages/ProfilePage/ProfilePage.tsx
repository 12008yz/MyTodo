import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../features/auth/AuthProvider";
import { HARSHNESS_OPTIONS } from "../../features/onboarding/constants";
import { useProfileTodayStats } from "../../features/profile/useProfileTodayStats";
import { AppSettingsModal } from "../../components/profile/AppSettingsModal";
import { EditHarshnessModal } from "../../components/profile/EditHarshnessModal";
import { EditNameModal } from "../../components/profile/EditNameModal";
import { EditPomodoroModal } from "../../components/profile/EditPomodoroModal";
import { EditScheduleModal } from "../../components/profile/EditScheduleModal";
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
import { ProfileInfoModal } from "../../components/profile/ProfileInfoModal";
import { SubscriptionModal } from "../../components/profile/SubscriptionModal";
import { formatContractLabel } from "../../components/profile/formatContractUntil";
import { ProfileMenuRow } from "../../components/profile/ProfileMenuRow";
import { ProfileMenuSection } from "../../components/profile/ProfileMenuSection";
import { isDemoMode } from "../../lib/demo-mode";
import { getEnglishToday } from "../../lib/api";
import { englishQueryKeys } from "../../features/english/useEnglish";
import "./ProfilePage.css";

function getUserInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0]!.toUpperCase() : "?";
}

function formatTime(value: string | null): string {
  if (!value) return "—";
  return value.slice(0, 5);
}

const ABOUT_TEXT =
  "«Новая глава» — приложение для ежедневного контроля привычек: светлая сторона роста и тёмная сторона отказа от вредного. Помодоро, статистика, коуч и курс английского помогают держать курс.";

const FAQ_TEXT =
  "Как закрыть день? Отметь все привычки на главной до конца дня. Что такое пропуск? До двух пропусков в неделю на привычку. Как работает залог? Функция появится скоро — следи за обновлениями в профиле.";

const HELP_TEXT =
  "Напиши нам на support@novayaglava.app — ответим в течение рабочего дня. Если что-то сломалось, укажи браузер и опиши шаги до ошибки.";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useAuth();
  const { pending, completed, isLoading } = useProfileTodayStats();
  const { data: englishToday } = useQuery({
    queryKey: englishQueryKeys.today,
    queryFn: getEnglishToday,
  });

  const [editNameOpen, setEditNameOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [pomodoroOpen, setPomodoroOpen] = useState(false);
  const [harshnessOpen, setHarshnessOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [faqOpen, setFaqOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

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
  const pomodoroHint = `${user.pomodoro_work_min} / ${user.pomodoro_break_min} мин`;
  const contractHint = user.trial_ends_at ? formatContractLabel(user.trial_ends_at) : undefined;

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
          onClick={() => setAppSettingsOpen(true)}
        />
        <ProfileMenuRow
          icon={<BellIcon />}
          label="Уведомления"
          onClick={() => setAppSettingsOpen(true)}
        />
        <ProfileMenuRow
          icon={<ClockIcon />}
          label="Помодоро"
          hint={pomodoroHint}
          onClick={() => setPomodoroOpen(true)}
        />
        <ProfileMenuRow
          icon={<SettingsIcon />}
          label="Жёсткость наставника"
          hint={harshness ? `${harshness.emoji} ${harshness.title}` : undefined}
          onClick={() => setHarshnessOpen(true)}
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
          onClick={() => setScheduleOpen(true)}
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
        <ProfileMenuRow
          icon={<CardIcon />}
          label="Подписка"
          hint={contractHint}
          onClick={() => setSubscriptionOpen(true)}
        />
      </ProfileMenuSection>

      <ProfileMenuSection title="О приложении">
        <ProfileMenuRow icon={<InfoIcon />} label="О нас" onClick={() => setAboutOpen(true)} />
        <ProfileMenuRow icon={<InfoIcon />} label="FAQ" onClick={() => setFaqOpen(true)} />
        <ProfileMenuRow icon={<HelpIcon />} label="Помощь и обратная связь" onClick={() => setHelpOpen(true)} />
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

      <AppSettingsModal
        open={appSettingsOpen}
        pomodoroHint={pomodoroHint}
        onClose={() => setAppSettingsOpen(false)}
        onOpenPomodoro={() => setPomodoroOpen(true)}
      />

      <EditPomodoroModal
        open={pomodoroOpen}
        workMin={user.pomodoro_work_min}
        breakMin={user.pomodoro_break_min}
        longBreakMin={user.pomodoro_long_break_min}
        onClose={() => setPomodoroOpen(false)}
        onSave={async (data) => {
          await updateProfile(data);
        }}
      />

      <EditHarshnessModal
        open={harshnessOpen}
        level={user.harshness_level}
        onClose={() => setHarshnessOpen(false)}
        onSave={async (harshness_level) => {
          await updateProfile({ harshness_level });
        }}
      />

      <EditScheduleModal
        open={scheduleOpen}
        wakeTime={user.wake_time}
        sleepTime={user.sleep_time}
        onClose={() => setScheduleOpen(false)}
        onSave={async (data) => {
          await updateProfile(data);
        }}
      />

      <ProfileInfoModal open={aboutOpen} title="О нас" art="chapter" onClose={() => setAboutOpen(false)}>
        {ABOUT_TEXT}
      </ProfileInfoModal>

      <ProfileInfoModal open={faqOpen} title="FAQ" art="orbit" onClose={() => setFaqOpen(false)}>
        {FAQ_TEXT}
      </ProfileInfoModal>

      <ProfileInfoModal
        open={helpOpen}
        title="Помощь и обратная связь"
        art="lifeline"
        onClose={() => setHelpOpen(false)}
      >
        {HELP_TEXT}
      </ProfileInfoModal>

      <SubscriptionModal open={subscriptionOpen} onClose={() => setSubscriptionOpen(false)} />
    </div>
  );
}
