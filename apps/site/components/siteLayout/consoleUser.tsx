"use client";

/**
 * Session-aware header action: shows the Console button for signed-out
 * visitors, and an avatar menu (Dashboard / Log out) once signed in.
 * Login state is detected client-side via /api/auth/me so the public
 * pages stay statically prerendered.
 */

import { useEffect, useState } from "react";

import { logout } from "@/app/actions";

import style from "./style.module.css";

interface MeResponse {
  user: { email: string; name: string | null } | null;
}

export default function ConsoleUser() {
  const [user, setUser] = useState<MeResponse["user"]>(null);

  useEffect(() => {
    fetch("/api/auth/me/")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MeResponse | null) => setUser(data?.user ?? null))
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <a href="/login/" className={`${style.btn} ${style.btnPrimary}`}>
        Console
      </a>
    );
  }

  return (
    <div className={style.userMenu}>
      <button type="button" className={style.userMenuToggle} aria-label="Account menu">
        <span className={style.userAvatar}>{user.email.charAt(0).toUpperCase()}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={style.userMenuDropdown}>
        <div className={style.userMenuEmail}>{user.name ?? user.email}</div>
        <a href="/dashboard/">Dashboard</a>
        <form action={logout}>
          <button type="submit" className={style.userMenuLogout}>Log out</button>
        </form>
      </div>
    </div>
  );
}
