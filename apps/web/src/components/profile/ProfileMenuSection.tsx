import type { ReactNode } from "react";

type ProfileMenuSectionProps = {
  title: string;
  children: ReactNode;
};

export function ProfileMenuSection({ title, children }: ProfileMenuSectionProps) {
  return (
    <section className="profile-menu-section">
      <h2 className="profile-menu-section__title">{title}</h2>
      <div className="profile-menu-section__list">{children}</div>
    </section>
  );
}
