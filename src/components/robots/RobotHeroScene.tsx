"use client";

import { RobotAvatar } from "./RobotAvatar";

/**
 * Lightweight cinematic hero scene — pure CSS/SVG, no WebGL.
 * Respects prefers-reduced-motion via CSS classes in globals.
 */
export function RobotHeroScene() {
  return (
    <div className="relative mx-auto h-[280px] w-full max-w-lg md:h-[340px]">
      <div className="pointer-events-none absolute inset-x-8 bottom-4 h-16 rounded-full bg-indigo-400/20 blur-2xl dark:bg-indigo-500/15" />
      <div className="pointer-events-none absolute left-1/2 top-8 h-40 w-40 -translate-x-1/2 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />

      <div className="nexa-float-slow absolute left-6 top-10 h-8 w-8 rounded-md bg-indigo-500/90 shadow-lg shadow-indigo-500/30" />
      <div className="nexa-float absolute right-10 top-16 h-6 w-6 rounded-md bg-amber-400/90 shadow-md" />
      <div className="nexa-float-delayed absolute bottom-16 left-12 h-5 w-10 rounded-md bg-emerald-400/80 shadow-md" />
      <div className="nexa-float-slow absolute bottom-20 right-8 h-7 w-7 rounded-full bg-violet-400/80 shadow-md" />

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-[42%] items-end gap-3 md:gap-5">
        <div className="nexa-float-delayed translate-y-4 opacity-90">
          <RobotAvatar id="moss" size="lg" animated />
        </div>
        <div className="nexa-float -translate-y-1">
          <RobotAvatar id="cobalt" size="xl" animated />
        </div>
        <div className="nexa-float-slow translate-y-3 opacity-95">
          <RobotAvatar id="ember" size="lg" animated />
        </div>
        <div className="nexa-float-delayed hidden translate-y-5 sm:block">
          <RobotAvatar id="violet" size="md" animated />
        </div>
      </div>

      <div className="absolute bottom-2 left-1/2 w-[85%] max-w-sm -translate-x-1/2 rounded-2xl border border-white/60 bg-white/70 px-4 py-2 text-center shadow-lg backdrop-blur dark:border-zinc-700/60 dark:bg-zinc-900/70">
        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
          Your modular AI team — ready to connect and work
        </p>
      </div>
    </div>
  );
}
