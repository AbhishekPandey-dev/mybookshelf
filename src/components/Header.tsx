import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { useVibration } from "@/hooks/useVibration";

interface HeaderProps {
  siteName: string;
  onSearchClick: () => void;
}

export const Header = ({ siteName, onSearchClick }: HeaderProps) => {
  const { vibrateLight } = useVibration();

  return (
    <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border transition-colors duration-300">
      <div className="container mx-auto h-16 flex items-center justify-between px-4">
        <Link to="/" className="font-heading font-bold text-xl text-foreground hover:opacity-80 transition-opacity">
          {siteName}
        </Link>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              vibrateLight();
              onSearchClick();
            }}
            className="w-12 h-12 rounded-full hover:bg-muted flex items-center justify-center press transition-colors"
            aria-label="Search"
          >
            <Search className="w-5 h-5 text-foreground" />
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

