import React from "react";
import type { LucideIcon } from "lucide-react";

export interface ErrorStateProps {
  icon: LucideIcon;
  code?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

/** Dipakai bareng oleh halaman 403/404/500 supaya tampilannya konsisten. */
export const ErrorState: React.FC<ErrorStateProps> = ({ icon: Icon, code, title, description, action }) => {
  return (
    <div className="min-h-screen w-full bg-app-mesh flex items-center justify-center p-6 relative overflow-hidden">
      <div className="dark:hidden fixed -top-40 -left-40 w-[500px] h-[500px] bg-blue-400/20 rounded-full blur-3xl pointer-events-none" />
      <div className="dark:hidden fixed -bottom-40 -right-40 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md glass-card rounded-[32px] p-8 sm:p-10 text-center flex flex-col items-center">
        <div className="w-16 h-16 rounded-full bg-[#f0f5ff] dark:bg-blue-500/10 text-[#0544cc] dark:text-[var(--accent-primary)] border border-blue-100 dark:border-blue-500/30 flex items-center justify-center shadow-sm mb-5">
          <Icon className="w-8 h-8 stroke-[2]" />
        </div>
        {code && <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-[var(--accent-primary)] mb-1.5">{code}</p>}
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-fg tracking-tight">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-fg-muted font-medium mt-2 leading-relaxed">{description}</p>
        {action && <div className="mt-6 w-full">{action}</div>}
      </div>
    </div>
  );
};
