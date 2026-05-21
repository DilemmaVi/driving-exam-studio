"use client";

import { useState, useEffect } from "react";
import { ChangelogModal } from "./ChangelogModal";

export function VersionBadge({ version }: { version: string }) {
  const [showChangelog, setShowChangelog] = useState(false);
  const [currentOnly, setCurrentOnly] = useState(false);

  useEffect(() => {
    const lastSeen = localStorage.getItem("lastSeenVersion");
    if (lastSeen !== version) {
      setCurrentOnly(true);
      setShowChangelog(true);
      localStorage.setItem("lastSeenVersion", version);
    }
  }, [version]);

  return (
    <>
      <button
        onClick={() => { setCurrentOnly(false); setShowChangelog(true); }}
        className="text-xs text-gray-400 hover:text-blue-600 transition cursor-pointer"
      >
        v{version}
      </button>
      <ChangelogModal
        open={showChangelog}
        onClose={() => setShowChangelog(false)}
        currentOnly={currentOnly}
      />
    </>
  );
}
