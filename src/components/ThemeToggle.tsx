import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-11 h-11 rounded-full"
    >
      {/* Sun shown in dark mode (click → go light); Moon shown in light mode */}
      <Sun className="w-5 h-5 rotate-0 scale-100 transition-all dark:hidden" />
      <Moon className="w-5 h-5 hidden dark:block dark:rotate-0 dark:scale-100 transition-all" />
    </Button>
  );
}
