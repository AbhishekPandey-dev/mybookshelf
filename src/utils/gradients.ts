export function getMeshGradient(color: string): string {
  const gradients: Record<string, string> = {
    indigo:
      "radial-gradient(at 40% 20%, #6366f1 0px, transparent 50%), radial-gradient(at 80% 0%, #818cf8 0px, transparent 50%), radial-gradient(at 0% 50%, #4f46e5 0px, transparent 50%)",
    violet:
      "radial-gradient(at 40% 20%, #7c3aed 0px, transparent 50%), radial-gradient(at 80% 0%, #8b5cf6 0px, transparent 50%), radial-gradient(at 0% 50%, #6d28d9 0px, transparent 50%)",
    blue:
      "radial-gradient(at 40% 20%, #2563eb 0px, transparent 50%), radial-gradient(at 80% 0%, #3b82f6 0px, transparent 50%), radial-gradient(at 0% 50%, #1d4ed8 0px, transparent 50%)",
    green:
      "radial-gradient(at 40% 20%, #16a34a 0px, transparent 50%), radial-gradient(at 80% 0%, #22c55e 0px, transparent 50%), radial-gradient(at 0% 50%, #15803d 0px, transparent 50%)",
    rose:
      "radial-gradient(at 40% 20%, #e11d48 0px, transparent 50%), radial-gradient(at 80% 0%, #f43f5e 0px, transparent 50%), radial-gradient(at 0% 50%, #be123c 0px, transparent 50%)",
    orange:
      "radial-gradient(at 40% 20%, #ea580c 0px, transparent 50%), radial-gradient(at 80% 0%, #f97316 0px, transparent 50%), radial-gradient(at 0% 50%, #c2410c 0px, transparent 50%)",
    amber:
      "radial-gradient(at 40% 20%, #d97706 0px, transparent 50%), radial-gradient(at 80% 0%, #f59e0b 0px, transparent 50%), radial-gradient(at 0% 50%, #b45309 0px, transparent 50%)",
    teal:
      "radial-gradient(at 40% 20%, #0d9488 0px, transparent 50%), radial-gradient(at 80% 0%, #14b8a6 0px, transparent 50%), radial-gradient(at 0% 50%, #0f766e 0px, transparent 50%)",
    pink:
      "radial-gradient(at 40% 20%, #db2777 0px, transparent 50%), radial-gradient(at 80% 0%, #ec4899 0px, transparent 50%), radial-gradient(at 0% 50%, #be185d 0px, transparent 50%)",
    slate:
      "radial-gradient(at 40% 20%, #475569 0px, transparent 50%), radial-gradient(at 80% 0%, #64748b 0px, transparent 50%), radial-gradient(at 0% 50%, #334155 0px, transparent 50%)",
  };
  return gradients[color] ?? gradients["indigo"];
}

/** Base solid colour for a subject's mesh background */
export function getMeshBase(color: string): string {
  const bases: Record<string, string> = {
    indigo: "#4f46e5",
    violet: "#6d28d9",
    blue: "#1d4ed8",
    green: "#15803d",
    rose: "#be123c",
    orange: "#c2410c",
    amber: "#b45309",
    teal: "#0f766e",
    pink: "#be185d",
    slate: "#334155",
  };
  return bases[color] ?? bases["indigo"];
}
