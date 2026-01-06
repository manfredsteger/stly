
import React, { useState } from 'react';
import { AppState, Vector3, SliceState } from '../types';
import { Download, Trash2, Box, Layers, Move, RefreshCw, Scissors, Sparkles, Loader2, ArrowUpDown, Minimize2, Maximize2 } from 'lucide-react';

interface ControlsProps {
  state: AppState;
  onTransformChange: (key: 'position' | 'rotation' | 'scale', value: any) => void;
  onSliceChange: (slice: SliceState) => void;
  onViewModeChange: (mode: AppState['viewMode']) => void;
  onColorChange: (color: string) => void;
  onReset: () => void;
  onExport: (mode?: 'full' | 'slice') => void;
  onClear: () => void;
  onAiAnalyze: () => void;
}

const ControlGroup: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
    <div className="flex items-center gap-2 mb-4 text-slate-300 font-semibold text-[10px] uppercase tracking-widest">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; color?: string; onChange: (v: number) => void }> = ({ label, value, min, max, step = 0.1, color = "accent-blue-500", onChange }) => (
  <div className="mb-3">
    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
      <span>{label}</span>
      <span className="font-mono">{value.toFixed(2)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={`w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer ${color}`}
    />
  </div>
);

const Controls: React.FC<ControlsProps> = ({ state, onTransformChange, onSliceChange, onViewModeChange, onColorChange, onReset, onExport, onClear, onAiAnalyze }) => {
  const [analyzing, setAnalyzing] = useState(false);

  if (!state.isLoaded) return (
      <div className="p-8 text-center text-slate-400">
          <Box className="mx-auto mb-4 opacity-20" size={64} />
          <p className="text-sm">Lade eine STL Datei hoch, um zu beginnen.</p>
      </div>
  );

  const stats = state.stats;
  const boundMin = stats ? Math.min(stats.boundingBox.min.x, stats.boundingBox.min.y, stats.boundingBox.min.z) - 50 : -100;
  const boundMax = stats ? Math.max(stats.boundingBox.max.x, stats.boundingBox.max.y, stats.boundingBox.max.z) + 50 : 100;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6 scrollbar-hide">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Box className="text-blue-400" size={20} />
            Editor
        </h2>
        <button onClick={onClear} className="p-2 text-slate-500 hover:text-red-400 transition-colors">
            <Trash2 size={18} />
        </button>
      </div>

      <ControlGroup title="Mesh Transformation" icon={<Move size={14} />}>
        <div className="space-y-4">
          <Slider label="Skalierung" value={state.transform.scale} min={0.1} max={5} step={0.01} onChange={(v) => onTransformChange('scale', v)} />
          <div className="grid grid-cols-2 gap-x-3">
             <Slider label="Rotation X" value={state.transform.rotation.x} min={-180} max={180} onChange={(v) => onTransformChange('rotation', { ...state.transform.rotation, x: v })} />
             <Slider label="Rotation Y" value={state.transform.rotation.y} min={-180} max={180} onChange={(v) => onTransformChange('rotation', { ...state.transform.rotation, y: v })} />
          </div>
        </div>
      </ControlGroup>

      <ControlGroup title="Slicing Werkzeuge" icon={<Scissors size={14} />}>
        <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-slate-300">Slicing Aktivieren</span>
            <button 
                onClick={() => onSliceChange({ ...state.slice, enabled: !state.slice.enabled })}
                className={`w-10 h-5 rounded-full transition-colors relative ${state.slice.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
            >
                <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${state.slice.enabled ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
        
        {state.slice.enabled && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                {/* Slicing Mode Toggle */}
                <div className="flex bg-slate-900/50 p-1 rounded-lg gap-1 border border-slate-700/30">
                    <button 
                        onClick={() => onSliceChange({ ...state.slice, mode: 'single' })}
                        className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.slice.mode === 'single' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Minimize2 size={10} /> Einfach
                    </button>
                    <button 
                        onClick={() => onSliceChange({ ...state.slice, mode: 'window' })}
                        className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${state.slice.mode === 'window' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-slate-300'}`}
                    >
                        <Maximize2 size={10} /> Fenster
                    </button>
                </div>

                <div className="flex bg-slate-900/50 p-1 rounded-lg gap-1">
                    {(['x', 'y', 'z'] as const).map(a => (
                        <button 
                            key={a}
                            onClick={() => onSliceChange({ ...state.slice, axis: a })}
                            className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition-all ${state.slice.axis === a ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            {a}
                        </button>
                    ))}
                </div>
                
                <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                    {state.slice.mode === 'single' ? (
                        <Slider 
                            label="Position" 
                            value={state.slice.singlePos} 
                            min={boundMin} max={boundMax} 
                            onChange={v => onSliceChange({ ...state.slice, singlePos: v })} 
                        />
                    ) : (
                        <>
                            <Slider 
                                label="Start (Ebene A)" 
                                value={state.slice.start} 
                                min={boundMin} max={boundMax} 
                                color="accent-blue-500"
                                onChange={v => onSliceChange({ ...state.slice, start: Math.min(v, state.slice.end - 1) })} 
                            />
                            <Slider 
                                label="Ende (Ebene B)" 
                                value={state.slice.end} 
                                min={boundMin} max={boundMax} 
                                color="accent-indigo-500"
                                onChange={v => onSliceChange({ ...state.slice, end: Math.max(v, state.slice.start + 1) })} 
                            />
                        </>
                    )}
                </div>

                {state.slice.mode === 'window' && (
                    <div className="flex items-center justify-between p-2 bg-blue-500/5 rounded border border-blue-500/10">
                        <span className="text-[10px] text-slate-400 font-medium">Bereich wählen:</span>
                        <div className="flex gap-1">
                            <button 
                                onClick={() => onSliceChange({ ...state.slice, showMiddle: true })}
                                className={`px-2 py-1 rounded text-[9px] font-bold ${state.slice.showMiddle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                Mitte
                            </button>
                            <button 
                                onClick={() => onSliceChange({ ...state.slice, showMiddle: false })}
                                className={`px-2 py-1 rounded text-[9px] font-bold ${!state.slice.showMiddle ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                            >
                                Außen
                            </button>
                        </div>
                    </div>
                )}
                
                <button onClick={() => onExport('slice')} className="w-full py-2 bg-blue-600/20 border border-blue-500/40 text-blue-400 text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 hover:bg-blue-600 hover:text-white transition-all">
                    <Download size={14}/> Schnitt exportieren
                </button>
            </div>
        )}
      </ControlGroup>

      <ControlGroup title="Darstellung" icon={<Layers size={14} />}>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {(['solid', 'wireframe', 'points'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => onViewModeChange(mode)}
              className={`py-1.5 text-[10px] font-bold uppercase rounded-lg border transition-all ${
                state.viewMode === mode
                  ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-400'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between">
           <span className="text-[10px] text-slate-400">Modellfarbe</span>
           <input type="color" value={state.color} onChange={(e) => onColorChange(e.target.value)} className="w-8 h-4 bg-transparent border-none cursor-pointer" />
        </div>
      </ControlGroup>

      <div className="mt-auto pt-4 space-y-3">
        <button 
          onClick={onReset}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold text-xs transition-all"
        >
          <RefreshCw size={16} />
          Reset View
        </button>
        <button 
          onClick={() => onExport('full')}
          className="w-full py-3 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/30 transition-all"
        >
          <Download size={16} />
          Gesamte Datei exportieren
        </button>
      </div>
    </div>
  );
};

export default Controls;
