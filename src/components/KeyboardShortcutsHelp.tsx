import { useState, useCallback } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

const shortcuts = [
  { keys: ['Ctrl', 'K'], description: 'Rechercher' },
  { keys: ['/'], description: 'Rechercher (hors champ texte)' },
  { keys: ['Esc'], description: 'Fermer / Annuler' },
  { keys: ['?'], description: 'Afficher les raccourcis' },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded shadow-sm">
      {children}
    </kbd>
  );
}

export default function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useKeyboardShortcuts({
    onHelp: toggle,
    onEscape: () => setIsOpen(false),
  });

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={toggle}
        className="fixed bottom-5 right-5 z-40 w-9 h-9 flex items-center justify-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-lg transition-all text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        title="Raccourcis clavier (?)"
      >
        <Keyboard className="w-4 h-4" />
      </button>

      {/* Modal overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity"
            onClick={() => setIsOpen(false)}
          />

          {/* Dialog */}
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-xl shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Raccourcis clavier</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="px-5 py-4 space-y-3">
              {shortcuts.map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">{shortcut.description}</span>
                  <div className="flex items-center gap-1">
                    {shortcut.keys.map((key, j) => (
                      <span key={j} className="flex items-center gap-1">
                        {j > 0 && <span className="text-xs text-gray-400">+</span>}
                        <Kbd>{key}</Kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-b-xl">
              <p className="text-xs text-gray-400 text-center">
                Appuyez sur <Kbd>?</Kbd> pour afficher/masquer
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
