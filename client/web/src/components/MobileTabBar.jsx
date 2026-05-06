import {navItems} from '../navItems.js';

const tabs = [...navItems, {id: 'playlist', label: 'Lists', icon: '☰'}];

export default function MobileTabBar({view, onNavigate}) {
  return (
    <nav className="md:hidden flex border-t border-gray-200 bg-white">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          className={`flex-1 flex flex-col items-center py-2 text-xs ${
            view === tab.id ? 'text-blue-600' : 'text-gray-400'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
