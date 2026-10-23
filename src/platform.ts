interface Droid {
  ankiSearchCard(query: string): void;
}
type HostWindow = Window & {
  pycmd?: (command: string) => void;
  AnkiDroidJS?: new (options: object) => Droid;
};
export function platform() {
  const host = window as HostWindow;
  const ios = /iPhone|iPad/.test(navigator.userAgent) ||
    document.documentElement.matches(".iphone,.ipad");
  let droid: Droid | undefined;
  return {
    native(action: "flip" | "again" | "hard" | "good" | "easy") {
      if (
        typeof host.pycmd !== "function" ||
        !navigator.userAgent.includes("QtWebEngine")
      )
        return false;
      const command =
        action === "flip"
          ? "ans"
          : (
              {
                again: "ease1",
                hard: "ease2",
                good: "ease3",
                easy: "ease4",
              } as const
            )[action];
      try {
        host.pycmd(command);
        return true;
      } catch {
        return false;
      }
    },
    note(nid: string) {
      if (!/^\d{13}$/.test(nid)) return false;
      if (ios) {
        location.href = `anki://x-callback-url/search?query=nid%3A${nid}`;
        return true;
      }
      if (host.AnkiDroidJS) {
        try {
          droid ??= new host.AnkiDroidJS({
            version: "0.0.3",
            developer: "github.com/zzpice/anki-mindmap",
          });
          droid.ankiSearchCard(`nid:${nid}`);
          return true;
        } catch {
          /* readable fallback */
        }
      }
      return false;
    },
  };
}
