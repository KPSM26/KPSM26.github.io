import { useEffect } from "react";
import { Settings, Bell, Monitor, Sun, Moon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useSettings, type Theme } from "@/hooks/useSettings";

export const SettingsPanel = () => {
  const { settings, update } = useSettings();

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "dark") {
      root.classList.add("dark");
    } else if (settings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", prefersDark);
    }
  }, [settings.theme]);

  const themes: { id: Theme; icon: typeof Sun; label: string }[] = [
    { id: "light", icon: Sun, label: "Light" },
    { id: "system", icon: Monitor, label: "Auto" },
    { id: "dark", icon: Moon, label: "Dark" },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          aria-label="Settings"
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Settings</p>
        </div>

        <div className="space-y-0 py-2">
          {/* Widget toggle */}
          <section className="px-4 py-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Widget</p>
            <div className="flex items-center justify-between">
              <Label htmlFor="widget-visible" className="cursor-pointer text-[13px]">
                Show widget
              </Label>
              <Switch
                id="widget-visible"
                checked={settings.widgetEnabled}
                onCheckedChange={v => update({ widgetEnabled: v })}
              />
            </div>
          </section>

          <div className="mx-4 h-px bg-border/50" />

          {/* Theme */}
          <section className="px-4 py-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Appearance</p>
            <div className="flex gap-1 rounded-md bg-muted/60 p-0.5">
              {themes.map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  onClick={() => update({ theme: id })}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1 rounded py-1 text-[11px] font-medium transition-colors",
                    settings.theme === id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="mx-4 h-px bg-border/50" />

          {/* Notifications */}
          <section className="px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-muted-foreground" />
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
        </div>
      </PopoverContent>
    </Popover>
  );
};
