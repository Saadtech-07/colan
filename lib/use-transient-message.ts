"use client";

import * as React from "react";

export function useTransientMessage(durationMs = 2000) {
  const [message, setMessage] = React.useState<string | null>(null);
  const timerRef = React.useRef<number | null>(null);

  const dismiss = React.useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const showMessage = React.useCallback(
    (next: string) => {
      dismiss();
      setMessage(next);
      timerRef.current = window.setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, durationMs);
    },
    [dismiss, durationMs],
  );

  React.useEffect(() => () => dismiss(), [dismiss]);

  return { message, showMessage, dismiss };
}
