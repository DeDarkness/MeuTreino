import { Dumbbell, House, Image as ImageIcon, Settings, TrendingUp } from 'lucide-react';

export type AppTab = 'home' | 'plans' | 'history' | 'wallpaper' | 'settings';

type BottomNavProps = {
  activeTab: AppTab | null;
  onChange: (tab: AppTab) => void;
};

const items = [
  { id: 'home' as const, label: 'Hoje', icon: House },
  { id: 'plans' as const, label: 'Treinos', icon: Dumbbell },
  { id: 'history' as const, label: 'Evolução', icon: TrendingUp },
  { id: 'wallpaper' as const, label: 'Wallpaper', icon: ImageIcon },
  { id: 'settings' as const, label: 'Ajustes', icon: Settings },
];

export function BottomNav({ activeTab, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Navegação principal">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          className={activeTab === id ? 'active' : ''}
          type="button"
          key={id}
          onClick={() => onChange(id)}
          aria-current={activeTab === id ? 'page' : undefined}
        >
          <Icon size={22} strokeWidth={activeTab === id ? 2.6 : 2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
