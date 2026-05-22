import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function GuideHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <header className="px-5 pt-8 pb-5 flex items-center gap-3">
      <Link
        to="/explore"
        className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center shrink-0"
        aria-label="Back"
      >
        <ArrowLeft className="w-4 h-4 text-foreground" />
      </Link>
      <span className="text-2xl" aria-hidden>{emoji}</span>
      <h1 className="text-2xl font-bold text-foreground leading-tight">{title}</h1>
    </header>
  );
}