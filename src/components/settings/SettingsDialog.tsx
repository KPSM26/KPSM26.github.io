import { useEffect } from "react";
import { Bell, Monitor, Moon, Sun, LayoutDashboard, Timer, Minus, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { useSettings, type Theme, type BufferStyle } from "@/hooks/useSettings";

const themes: { id: Theme; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Light" },
  { id: "system", icon: Monitor, label: "Auto" },
  { id: "dark", icon: Moon, label: "Dark" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsDialog = ({ open, onOpenChange }: Props) => {
  const { settings, update } = useSettings();

  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      root.classList.toggle("dark", mq.matches);
      const handler = (e: MediaQueryListEvent) => root.classList.toggle("dark", e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings.theme]);

  const decreaseBuffer = () => {
    const next = Math.max(5, settings.bufferDurationMin - 5);
    update({ bufferDurationMin: next });
  };

  const increaseBuffer = () => {
    const next = Math.min(30, settings.bufferDurationMin + 5);
    update({ bufferDurationMin: next });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-80 gap-0 p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4">
          <DialogTitle className="text-[15px] font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="divide-y divide-border/50 py-1">

          {/* Widget */}
          <section className="px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Widget
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="widget-enabled" className="cursor-pointer text-[13px]">
                  Show to-do widget
                </Label>
              </div>
              <Switch
                id="widget-enabled"
                checked={settings.widgetEnabled}
                onCheckedChange={v => update({ widgetEnabled: v })}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              Floating task list on your desktop
            </p>
          </section>

          {/* Appearance */}
          <section className="px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Appearance
            </p>
            <div className="flex gap-1 rounded-lg bg-muted/60 p-0.5">
              {themes.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => update({ theme: id })}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-all",
                    settings.theme === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          {/* Cognitive Buffer */}
          <section className="px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Cognitive Buffer
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Timer className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="buffer-enabled" className="cursor-pointer text-[13px]">
                  Auto-buffer
                </Label>
              </div>
              <Switch
                id="buffer-enabled"
                checked={settings.bufferEnabled}
                onCheckedChange={v => update({ bufferEnabled: v })}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/70">
              Adds breathing room between back-to-back blocks
            </p>

            {settings.bufferEnabled && (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Buffer style
                  </p>
                  <RadioGroup
                    value={settings.bufferStyle}
                    onValueChange={v => update({ bufferStyle: v as BufferStyle })}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="gap" id="buffer-gap" />
                      <Label htmlFor="buffer-gap" className="cursor-pointer text-[13px] font-normal">
                        Just a gap
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="dot" id="buffer-dot" />
                      <Label htmlFor="buffer-dot" className="cursor-pointer text-[13px] font-normal">
                        Thin line with dot
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                    Buffer duration
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={decreaseBuffer}
                      disabled={settings.bufferDurationMin <= 5}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md border border-border/60 transition-colors",
                        settings.bufferDurationMin <= 5
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : "text-foreground hover:bg-foreground/5"
                      )}
                      aria-label="Decrease buffer"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="min-w-[60px] text-center text-[13px] tabular-nums">
                      {settings.bufferDurationMin} min
                    </span>
                    <button
                      onClick={increaseBuffer}
                      disabled={settings.bufferDurationMin >= 30}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md border border-border/60 transition-colors",
                        settings.bufferDurationMin >= 30
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : "text-foreground hover:bg-foreground/5"
                      )}
                      aria-label="Increase buffer"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notifications */}
          <section className="px-5 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="notifications" className="cursor-pointer text-[13px]">
                  Reminders
                </Label>
              </div>
              <Switch
                id="notifications"
                checked={settings.notifications}
                onCheckedChange={v => update({ notifications: v })}
              />
            </div>
            {settings.notifications && (
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Notifications coming soon.
              </p>
            )}
          </section>

          {/* Shortcut hint */}
          <div className="px-5 py-3">
            <p className="text-[11px] text-muted-foreground/60">
              Press <span className="kbd">⌘</span> <span className="kbd">⇧</span> <span className="kbd">S</span> to toggle settings
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
