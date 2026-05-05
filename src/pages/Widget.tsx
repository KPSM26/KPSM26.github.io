import { useEffect, useRef } from "react";
import { ScheduleWidget } from "@/components/widget/ScheduleWidget";
import { TimeBlocksProvider } from "@/hooks/useTimeBlocksCtx";

const WidgetOverlay = () => {
  const widgetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-transparent">
      <div ref={widgetRef}>
        <ScheduleWidget />
      </div>
    </div>
  );
};

const Widget = () => (
  <TimeBlocksProvider>
    <WidgetOverlay />
  </TimeBlocksProvider>
);

export default Widget;
