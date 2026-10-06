import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const POLL_MS = 12_000;

export const STATE_LABEL: Record<string, string> = {
  Greeting: "Saludo",
  Qualify: "Calificación",
  Answer: "Respuestas",
  Handoff: "Derivado",
  Closed: "Cerrado",
};
