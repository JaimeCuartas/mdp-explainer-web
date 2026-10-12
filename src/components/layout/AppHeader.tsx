import { Activity, Menu } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  isSidebarOpen: boolean;
  onTitleChange: (title: string) => void;
  onToggleSidebar: () => void;
}

export function AppHeader({ title, isSidebarOpen, onTitleChange, onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="app-header">
      <button
        type="button"
        className="app-header-menu-button"
        onClick={onToggleSidebar}
        aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        aria-expanded={isSidebarOpen}
        aria-controls="app-sidebar"
      >
        <Menu size={20} />
      </button>
      <Activity size={20} color="#2563eb" />
      <input
        type="text"
        className="mdp-title-input"
        value={title}
        onChange={(event) => onTitleChange(event.target.value)}
        aria-label="MDP title"
      />
    </header>
  );
}
