import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useVibration } from "@/hooks/useVibration";

export const ThemeToggle = () => {
  const [isDark, setIsDark] = useState(false);
  const { vibrateLight } = useVibration();

  useEffect(() => {
    const root = window.document.documentElement;
    const initialColorValue = root.classList.contains("dark");
    setIsDark(initialColorValue);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    const newTheme = !isDark;
    
    if (newTheme) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
    
    setIsDark(newTheme);
    vibrateLight();
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative w-12 h-12 rounded-full flex items-center justify-center hover:bg-muted transition-all duration-300 press overflow-hidden group"
      aria-label="Toggle Theme"
    >
      <div className="relative w-5 h-5 overflow-hidden">
        <Sun 
          className={`w-5 h-5 text-foreground transition-all duration-500 absolute inset-0 ${
            isDark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`} 
        />
        <Moon 
          className={`w-5 h-5 text-foreground transition-all duration-500 absolute inset-0 ${
            isDark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0"
          }`} 
        />
      </div>
      
      {/* Subtle glow effect */}
      <span className="absolute inset-0 rounded-full bg-primary/0 group-hover:bg-primary/5 transition-colors duration-300" />
    </button>
  );
};
