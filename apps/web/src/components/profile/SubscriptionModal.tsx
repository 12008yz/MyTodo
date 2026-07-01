import { useEffect, useState } from "react";
import {
  SUBSCRIPTION_PLAN_IDS,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanId,
} from "@mytodo/shared";
import { ClientApiError, subscribeBilling } from "../../lib/api";
import { isDemoMode } from "../../lib/demo-mode";
import { ProfileModal } from "./ProfileModal";

const PLAN_LABELS: Record<SubscriptionPlanId, { title: string; note: string }> = {
  monthly: {
    title: "1 месяц",
    note: "Автопродление каждые 30 дней",
  },
  "2months": {
    title: "2 месяца",
    note: "Разовая оплата на 60 дней",
  },
  "3months": {
    title: "3 месяца",
    note: "Разовая оплата на 90 дней",
  },
};

function formatPrice(rub: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(rub);
}

type SubscriptionModalProps = {
  open: boolean;
  onClose: () => void;
};

function mapSubscribeError(err: unknown): string {
  if (err instanceof ClientApiError) {
    if (err.status === 409 || err.code === "CONFLICT") {
      return "У тебя уже есть активная подписка.";
    }
    if (err.status === 402 || err.code === "PAYMENT_REQUIRED") {
      return "Сначала нужно оформить подписку — выбери тариф и оплати.";
    }
    if (err.status === 0 || err.code === "SERVICE_UNAVAILABLE") {
      return err.message;
    }
    return err.message || "Не удалось начать оплату. Попробуй позже.";
  }

  return err instanceof Error ? err.message : "Не удалось начать оплату. Попробуй позже.";
}

export function SubscriptionModal({ open, onClose }: SubscriptionModalProps) {
  const [selected, setSelected] = useState<SubscriptionPlanId>("monthly");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setSelected("monthly");
      setError(null);
    }
  }, [open]);

  const handleSubscribe = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await subscribeBilling({ plan: selected });

      if (isDemoMode()) {
        window.alert(
          `Демо-режим: оплата не выполняется. Выбран тариф «${PLAN_LABELS[selected].title}» — ${formatPrice(result.amount_rub)}.`,
        );
        onClose();
        return;
      }

      window.location.assign(result.confirmation_url);
    } catch (err) {
      setError(mapSubscribeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProfileModal
      open={open}
      title="Подписка"
      art="chapter"
      wide
      onClose={onClose}
      onSave={handleSubscribe}
      saveLabel={isSubmitting ? "Переходим к оплате…" : "Оплатить"}
      isSaving={isSubmitting}
      error={error}
    >
      <p className="profile-modal__hint">
        3 дня бесплатно уже включены. Выбери тариф — оплата через ЮKassa, доступ откроется сразу после
        успешного платежа.
      </p>
      <div className="profile-modal__choices" role="radiogroup" aria-label="Тариф подписки">
        {SUBSCRIPTION_PLAN_IDS.map((planId) => {
          const plan = SUBSCRIPTION_PLANS[planId];
          const label = PLAN_LABELS[planId];

          return (
            <button
              key={planId}
              type="button"
              role="radio"
              aria-checked={selected === planId}
              className={[
                "profile-modal__choice",
                selected === planId ? "profile-modal__choice--selected" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => setSelected(planId)}
            >
              <p className="profile-modal__choice-title">
                {label.title} — {formatPrice(plan.priceRub)}
              </p>
              <p className="profile-modal__choice-quote">{label.note}</p>
            </button>
          );
        })}
      </div>
    </ProfileModal>
  );
}
