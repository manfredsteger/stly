
import React, { useState, useRef } from 'react';
import * as THREE from 'this-package-placeholder'; // Dynamic import handled by build system, just keeping imports clean
import * as THREELib from 'three';
// Added Maximize2 and Move to fix the reported errors
import { Upload, Box, Github, HelpCircle, Activity, Scissors, Sparkles, Maximize2, Move } from 'lucide-react';
import Viewer from './components/Viewer';
import Controls from './components/Controls';
import { AppState, TransformationState, SliceState } from './types';
import { stlService } from './services/stlService';

const INITIAL_TRANSFORM: TransformationState = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: 1
};

const INITIAL_SLICE: SliceState = {
  enabled: false,
  mode: 'single',
  axis: 'z',
  singlePos: 0,
  start: -20,
  end: 20,
  showMiddle: true
};

const INITIAL_STATE: AppState = {
  isLoaded: false,
  fileName: null,
  transform: INITIAL_TRANSFORM,
  slice: INITIAL_SLICE,
  stats: null,
  viewMode: 'solid',
  color: '#3b82f6',
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [geometry, setGeometry] = useState<THREELib.BufferGeometry | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const geo = await stlService.loadFromBuffer(buffer);
      const stats = stlService.calculateStats(geo);

      setGeometry(geo);
      setState(prev => ({
        ...prev,
        isLoaded: true,
        fileName: file.name,
        stats,
        transform: INITIAL_TRANSFORM,
        slice: { 
          ...INITIAL_SLICE, 
          singlePos: (stats.boundingBox.min.z + stats.boundingBox.max.z) / 2,
          start: stats.boundingBox.min.z + (stats.boundingBox.size.z * 0.25), 
          end: stats.boundingBox.max.z - (stats.boundingBox.size.z * 0.25)
        }
      }));
    } catch (err) {
      alert("Fehler beim Verarbeiten der Datei.");
    }
  };

  const handleAiAnalyze = async () => {
    if (!state.stats) return;
    const analysis = await stlService.analyzeWithAI(state.stats);
    setState(prev => ({ ...prev, aiAnalysis: analysis }));
  };

  const handleExport = (mode: 'full' | 'slice' = 'full') => {
    if (!geometry) return;

    const tempMesh = new THREELib.Mesh(geometry.clone());
    tempMesh.position.set(state.transform.position.x, state.transform.position.y, state.transform.position.z);
    tempMesh.rotation.set(
      THREELib.MathUtils.degToRad(state.transform.rotation.x),
      THREELib.MathUtils.degToRad(state.transform.rotation.y),
      THREELib.MathUtils.degToRad(state.transform.rotation.z)
    );
    tempMesh.scale.setScalar(state.transform.scale);
    tempMesh.updateMatrixWorld();

    const blob = stlService.exportMesh(tempMesh);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = mode === 'slice' ? `slice_${state.fileName}` : `edited_${state.fileName}`;
    link.click();
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-50 overflow-hidden select-none">
      <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 z-10 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20">
                <Activity size={20} className="text-white" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">STLEdit <span className="text-blue-500">Pro</span></h1>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Controls 
            state={state}
            onTransformChange={(key, value) => setState(prev => ({ ...prev, transform: { ...prev.transform, [key]: value }}))}
            onSliceChange={(slice) => setState(prev => ({ ...prev, slice }))}
            onViewModeChange={(mode) => setState(prev => ({ ...prev, viewMode: mode }))}
            onColorChange={(color) => setState(prev => ({ ...prev, color }))}
            onReset={() => setState(prev => ({ ...prev, transform: INITIAL_TRANSFORM }))}
            onExport={handleExport}
            onClear={() => { setGeometry(null); setState(INITIAL_STATE); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            onAiAnalyze={handleAiAnalyze}
          />
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-950 overflow-hidden">
        <div className="absolute top-6 left-6 z-20 flex gap-4">
            <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 px-5 py-2.5 rounded-2xl shadow-2xl">
                <input type="file" accept=".stl" onChange={handleFileUpload} ref={fileInputRef} className="hidden" id="stl-upload" />
                <label htmlFor="stl-upload" className="flex items-center gap-2.5 text-sm font-bold cursor-pointer text-slate-300 hover:text-white transition-all group">
                    <Upload size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    {state.fileName ? 'Andere Datei wählen' : 'STL Modell hochladen'}
                </label>
                {state.fileName && (
                    <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-800">
                        <span className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{state.fileName}</span>
                    </div>
                )}
            </div>
        </div>

        <div className="w-full h-full">
          {state.isLoaded ? (
            <Viewer geometry={geometry} state={state} />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-8">
              <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-[80px] opacity-10 rounded-full animate-pulse" />
                  <div className="relative w-32 h-32 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
                    <Box size={56} className="text-slate-800" />
                  </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-slate-300">STL Mesh-Editor</h3>
                <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
                    Transformieren Sie Ihre Modelle oder nutzen Sie das Fenster-Slicing für präzise Schnitte.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-800/50">
                     <Maximize2 size={16} className="text-blue-400" />
                     <span className="text-[10px] uppercase font-bold text-slate-500">Dual Slicing</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-900/40 px-4 py-2 rounded-lg border border-slate-800/50">
                     <Move size={16} className="text-blue-400" />
                     <span className="text-[10px] uppercase font-bold text-slate-500">Transform</span>
                  </div>
              </div>
            </div>
          )}
        </div>

        {state.isLoaded && (
            <div className="absolute bottom-6 right-6 z-20 flex flex-col items-end gap-2 bg-slate-900/60 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-800/50 text-[10px] text-slate-400 font-mono shadow-xl">
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500" /> {state.slice.mode.toUpperCase()} SLICE: {state.slice.axis.toUpperCase()}</div>
               <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500" /> TRIANGLES: {state.stats?.triangleCount.toLocaleString()}</div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
