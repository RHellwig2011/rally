"use client";

import { useEffect } from "react";

/** Refresh the 15-minute access cookie while a tab is open. */
export function SessionKeepAlive() {
  useEffect(() => {
    const tick = () => {
      fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(
        () => undefined
      );
    };
    tick();
    const id = setInterval(tick, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}
