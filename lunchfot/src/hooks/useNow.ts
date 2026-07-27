import { useEffect, useState } from "react";

export const useNow = (active = true, intervalMs = 80) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!active) {
      return;
    }

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);

    return () => window.clearInterval(interval);
  }, [active, intervalMs]);

  return now;
};
