import React from 'react';
import { X, Keyboard, MousePointer2 } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div className="flex items-center gap-2 text-blue-400">
            <Keyboard size={20} />
            <h2 className="font-bold text-lg text-slate-100">Tastaturkürzel & Steuerung</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-8 scrollbar-hide text-sm">
          
          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 uppercase tracking-wider text-xs">
              <Keyboard size={14} className="text-slate-500" />
              Allgemeine Aktionen
            </h3>
            <div className="space-y-3">
              <ShortcutRow shortcut={["Entf", "Backspace"]} description="Ausgewähltes Objekt löschen" />
              <ShortcutRow shortcut={["Strg", "Z"]} description="Aktion rückgängig machen (Undo)" />
              <ShortcutRow shortcut={["Strg", "Y"]} description="Aktion wiederherstellen (Redo)" />
              <ShortcutRow shortcut={["Strg", "Shift", "Z"]} description="Aktion wiederherstellen (Redo)" />
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 uppercase tracking-wider text-xs">
              <MousePointer2 size={14} className="text-slate-500" />
              Kamerasteuerung (3D-Ansicht)
            </h3>
            <div className="space-y-3">
              <ShortcutRow shortcut={["Linksklick + Ziehen"]} description="Kamera rotieren" />
              <ShortcutRow shortcut={["Rechtsklick + Ziehen"]} description="Kamera verschieben (Pan)" />
              <ShortcutRow shortcut={["Mausrad"]} description="Kamera zoomen" />
            </div>
          </section>

          <section>
            <h3 className="flex items-center gap-2 font-bold text-slate-300 mb-4 uppercase tracking-wider text-xs">
              <MousePointer2 size={14} className="text-slate-500" />
              Objektauswahl (Szene-Explorer)
            </h3>
            <div className="space-y-3">
              <ShortcutRow shortcut={["Linksklick"]} description="Objekt auswählen" />
              <ShortcutRow shortcut={["Strg", "+", "Linksklick"]} description="Objekte zur Auswahl hinzufügen" />
              <ShortcutRow shortcut={["Shift", "+", "Linksklick"]} description="Mehrere Objekte auswählen" />
              <ShortcutRow shortcut={["Klick auf Namen"]} description="Objekt umbenennen" />
            </div>
          </section>
          
          <div className="text-xs text-slate-500 mt-4 pt-4 border-t border-slate-800">
            * Auf einem Mac wird statt 'Strg' (Control) die 'Cmd' (Command) Taste verwendet.
          </div>
        </div>
      </div>
    </div>
  );
};

const ShortcutRow = ({ shortcut, description }: { shortcut: string[], description: string }) => (
  <div className="flex items-center justify-between group hover:bg-slate-800/50 p-2 rounded-lg -mx-2 transition-colors">
    <span className="text-slate-300">{description}</span>
    <div className="flex items-center gap-1.5">
      {shortcut.map((key, i) => (
        <React.Fragment key={i}>
          <kbd className="px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300 font-mono text-xs shadow-sm">
            {key}
          </kbd>
          {i < shortcut.length - 1 && key !== "+" && shortcut[i+1] !== "+" && <span className="text-slate-600 text-xs">+</span>}
        </React.Fragment>
      ))}
    </div>
  </div>
);
