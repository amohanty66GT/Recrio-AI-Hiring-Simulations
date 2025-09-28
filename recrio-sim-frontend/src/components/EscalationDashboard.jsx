import React from "react";

/**
 * Props:
 * - timeRemaining?: number // seconds remaining
 * - simulationEnded?: boolean
 */
export function EscalationDashboard({
  timeRemaining = 0,
  simulationEnded = false,
}) {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (simulationEnded) return "text-red-600";
    if (timeRemaining <= 300) return "text-red-500";
    if (timeRemaining <= 600) return "text-yellow-500";
    return "text-green-600";
  };

  return (
    <aside className="fixed right-0 top-0 h-screen w-[320px] bg-white/95 backdrop-blur border-l border-black/10 z-30 p-4 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center">
        <h2 className="text-lg font-semibold mb-2">Scenario Progress</h2>
        <div className={`text-center mb-4 p-3 rounded-lg border-2 ${
          simulationEnded
            ? 'bg-red-50 border-red-200'
            : timeRemaining <= 300
            ? 'bg-red-50 border-red-200'
            : timeRemaining <= 600
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-green-50 border-green-200'
        }`}>
          <div className="text-xs text-gray-600 mb-1">Time Remaining</div>
          <div className={`text-2xl font-bold ${getTimerColor()}`}>
            {simulationEnded ? "00:00" : formatTime(timeRemaining)}
          </div>
          {simulationEnded && (
            <div className="text-xs text-red-600 mt-1 font-semibold">
              Simulation Ended
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}