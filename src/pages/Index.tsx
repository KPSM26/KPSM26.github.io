import { useEffect, useState } from "react";
import { WeekView } from "@/components/calendar/WeekView";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { Settings } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const Index = () => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "S") {
        e.preventDefault();
        setSettingsOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <main className="relative min-h-screen bg-background">
      <WeekView onOpenSettings={() => setSettingsOpen(true)} />

      {!isMobile && (
        <button
          onClick={() => setSettingsOpen(true)}
          className="fixed bottom-6 right-6 z-50 grid h-10 w-10 place-items-center rounded-full bg-card text-muted-foreground shadow-soft transition-all hover:bg-foreground/5 hover:text-foreground hover:shadow-fab"
          aria-label="Open settings"
          title="Settings (⌘⇧S)"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      )}

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </main>
  );
};

export default Index;
