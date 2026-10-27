import {navItems} from '../navItems.js';

const tabs = [...navItems, {id: 'playlist', label: 'Lists', icon: '☰'}];

export default function MobileTabBar({view, onNavigate}) {
  return (
    <nav
      className="md:hidden flex border-t border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
      style={{paddingBottom: 'env(safe-area-inset-bottom)'}}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onNavigate(tab.id)}
          className={`flex-1 flex flex-col items-center py-2 text-xs ${
            view === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-neutral-500'
          }`}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  );
}
