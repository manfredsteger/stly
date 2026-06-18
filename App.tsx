
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Upload, Download, Box, Activity, Package, Scissors, Sparkles, Move, Layers, UploadCloud, Undo2, Redo2 } from 'lucide-react';
import Viewer from './components/Viewer';
import Controls from './components/Controls';
import { AppState, SceneObject, SliceState, TransformationState, SplitState, ExtendState } from './types';
import { stlService } from './services/stlService';

const INITIAL_SLICE: SliceState = {
  enabled: false,
  mode: 'window',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  windowSize: 40,
  showMiddle: true
};

const INITIAL_SPLIT: SplitState = {
  enabled: false,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  jointType: 'flat',
  jointSize: 10,
  jointDepth: 10,
  clearance: 0.2
};

const INITIAL_EXTEND: ExtendState = {
  enabled: false,
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  amount: 20
};

const INITIAL_STATE: AppState = {
  objects: [],
  selectedId: null,
  slice: INITIAL_SLICE,
  split: INITIAL_SPLIT,
  extend: INITIAL_EXTEND,
  viewMode: 'solid',
  globalColor: '#3b82f6',
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [pastObjects, setPastObjects] = useState<SceneObject[][]>([]);
  const [futureObjects, setFutureObjects] = useState<SceneObject[][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPartsMenuOpen, setIsPartsMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const pushHistory = () => {
    setPastObjects(p => {
        // Debounce: don't push if the last saved state is identical to current
        if (p.length > 0 && p[p.length - 1] === state.objects) return p;
        return [...p, state.objects];
    });
    setFutureObjects([]);
  };

  const handleUndo = () => {
    if (pastObjects.length === 0) return;
    const previous = pastObjects[pastObjects.length - 1];
    setPastObjects(prev => prev.slice(0, prev.length - 1));
    setFutureObjects(prev => [state.objects, ...prev]);
    setState(prev => ({ ...prev, objects: previous }));
  };

  const handleRedo = () => {
    if (futureObjects.length === 0) return;
    const next = futureObjects[0];
    setFutureObjects(prev => prev.slice(1));
    setPastObjects(prev => [...prev, state.objects]);
    setState(prev => ({ ...prev, objects: next }));
  };

  // Auto-dismiss errors after 6 seconds
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (cmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (cmdOrCtrl && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedId) {
          e.preventDefault();
          handleDelete(state.selectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pastObjects, futureObjects, state.selectedId, state.objects]);

  const processFile = async (file: File) => {
    if (file.name.toLowerCase().endsWith('.stlc')) {
      await loadProject(file);
      return;
    }
    if (!file.name.toLowerCase().endsWith('.stl')) return;
    
    try {
      const buffer = await file.arrayBuffer();
      const geo = await stlService.loadFromBuffer(buffer);
      
      if (!geo || !geo.attributes.position || geo.attributes.position.count === 0) {
        throw new Error("Ungültige oder unvollständige STL-Geometrie.");
      }

      geo.center();
      const stats = stlService.calculateStats(geo);
      
      const newObj: SceneObject = {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name.replace('.stl', ''),
        geometry: geo,
        transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
        visible: true,
        color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'),
        stats
      };

      pushHistory();
      setState(prev => ({
        ...prev,
        objects: [...prev.objects, newObj],
        selectedId: newObj.id
      }));
    } catch (err: any) {
      console.error("Error loading STL:", err);
      setErrorMsg(`Fehler beim Laden von "${file.name}": ${err.message || err.toString()}`);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;
    // Fix: Explicitly cast Array.from(files) to File[] to avoid 'unknown' type error
    for (const file of Array.from(files) as File[]) {
      await processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounter.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // Fix: Explicitly cast Array.from(files) to File[] to avoid 'unknown' type error
      for (const file of Array.from(files) as File[]) {
        await processFile(file);
      }
    }
  };

  const handleBakeSlice = async () => {
    const selected = state.objects.find(o => o.id === state.selectedId);
    if (!selected || !state.slice.enabled) return;

    try {
        const { csgService } = await import('./services/csgService');
        const newGeo = csgService.performSlice(selected, state.slice);
        if (!newGeo) return;

        const newObj: SceneObject = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${selected.name}_Slice`,
            geometry: newGeo,
            transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // Transform is baked in
            visible: true,
            color: selected.color,
            stats: stlService.calculateStats(newGeo)
        };

        pushHistory();
        setState(prev => ({
            ...prev,
            objects: [...prev.objects, newObj],
            selectedId: newObj.id,
            slice: { ...prev.slice, enabled: false }
        }));
    } catch (err: any) {
        console.error("CSG Slice Error:", err);
        setErrorMsg(`Fehler beim Slicen: ${err.message || err.toString()}`);
    }
  };

  const handlePerformSplit = async () => {
      const selected = state.objects.find(o => o.id === state.selectedId);
      if (!selected || !state.split.enabled) return;
      
      try {
          const { csgService } = await import('./services/csgService');
          const result = csgService.performSplit(selected, state.split);
          if (!result) return;

          const partAObj: SceneObject = {
              id: Math.random().toString(36).substr(2, 9),
              name: `${selected.name}_A`,
              geometry: result.partA,
              transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // baked transform
              visible: true,
              color: selected.color,
              stats: stlService.calculateStats(result.partA)
          };

          const partBObj: SceneObject = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${selected.name}_B`,
            geometry: result.partB,
            transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 }, // baked transform
            visible: true,
            color: '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0'), // slightly different color
            stats: stlService.calculateStats(result.partB)
          };

          pushHistory();
          // We remove original object and replace it with partA and partB
          setState(prev => ({
              ...prev,
              objects: prev.objects.filter(o => o.id !== selected.id).concat([partAObj, partBObj]),
              selectedId: partAObj.id,
              split: { ...prev.split, enabled: false }
          }));
      } catch (err: any) {
          console.error("CSG Error:", err);
          setErrorMsg(`Fehler beim Teilen: ${err.message || err.toString()}`);
      }
  };

  const handleMirrorObject = (id: string, axis: 'x' | 'y' | 'z') => {
      const obj = state.objects.find(o => o.id === id);
      if (!obj) return;
      
      const newGeo = obj.geometry.clone();
      newGeo.scale(
          axis === 'x' ? -1 : 1,
          axis === 'y' ? -1 : 1,
          axis === 'z' ? -1 : 1
      );
      
      const index = newGeo.getIndex();
      if (index) {
          for (let i = 0; i < index.count; i += 3) {
              const a = index.getX(i);
              const b = index.getX(i + 1);
              const c = index.getX(i + 2);
              index.setX(i, a);
              index.setX(i + 1, c);
              index.setX(i + 2, b);
          }
      } else {
          const pos = newGeo.getAttribute('position');
          const newPos = new Float32Array(pos.count * 3);
          for (let i = 0; i < pos.count; i += 3) {
              newPos[(i)*3] = pos.getX(i);
              newPos[(i)*3+1] = pos.getY(i);
              newPos[(i)*3+2] = pos.getZ(i);

              newPos[(i+1)*3] = pos.getX(i+2);
              newPos[(i+1)*3+1] = pos.getY(i+2);
              newPos[(i+1)*3+2] = pos.getZ(i+2);

              newPos[(i+2)*3] = pos.getX(i+1);
              newPos[(i+2)*3+1] = pos.getY(i+1);
              newPos[(i+2)*3+2] = pos.getZ(i+1);
          }
          newGeo.setAttribute('position', new THREE.BufferAttribute(newPos, 3));
      }
      
      newGeo.computeVertexNormals();
      
      pushHistory();
      setState(prev => ({
          ...prev,
          objects: prev.objects.map(o => o.id === id ? {
              ...o,
              geometry: newGeo,
              stats: stlService.calculateStats(newGeo)
          } : o)
      }));
  };

  const handleMergeObjects = async () => {
      const visibleObjects = state.objects.filter(o => o.visible);
      if (visibleObjects.length < 2) {
          setErrorMsg("Bitte machen Sie mindestens 2 Objekte sichtbar, um sie zu fusionieren.");
          return;
      }
      
      setIsProcessing(true);
      
      try {
          // Add small delay for UI to update
          await new Promise(resolve => setTimeout(resolve, 50));
          const { csgService } = await import('./services/csgService');
          const mergedGeo = csgService.mergeObjects(visibleObjects);
          if (!mergedGeo) throw new Error("CSG Combine failed.");

          const newObj: SceneObject = {
              id: Math.random().toString(36).substr(2, 9),
              name: `Fusion (${visibleObjects.length} Teile)`,
              geometry: mergedGeo,
              transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1 },
              visible: true,
              color: state.globalColor,
              stats: stlService.calculateStats(mergedGeo)
          };

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.filter(o => !o.visible).concat([newObj]),
              selectedId: newObj.id
          }));
      } catch (err: any) {
          console.error("Merge Error:", err);
          setErrorMsg(`Fehler beim Fusionieren: ${err.message || err.toString()}`);
      } finally {
          setIsProcessing(false);
      }
  };

  const handlePerformExtend = async () => {
      const selected = state.objects.find(o => o.id === state.selectedId);
      if (!selected || !state.extend.enabled) return;
      
      try {
          const { csgService } = await import('./services/csgService');
          const extendedGeo = csgService.performExtend(selected, state.extend);
          if (!extendedGeo) return;

          const newObj: SceneObject = {
              id: Math.random().toString(36).substr(2, 9),
              name: `${selected.name}_Extended`,
              geometry: extendedGeo,
              transform: { ...selected.transform },
              visible: true,
              color: selected.color,
              stats: stlService.calculateStats(extendedGeo)
          };

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.filter(o => o.id !== selected.id).concat([newObj]),
              selectedId: newObj.id,
              extend: { ...prev.extend, enabled: false }
          }));
      } catch (err: any) {
          console.error("Extend Error:", err);
          setErrorMsg(`Fehler bei der Verlängerung: ${err.message || err.toString()}`);
      }
  };

  const saveProject = () => {
    try {
      const serializableState = {
        ...state,
        objects: state.objects.map(obj => ({
          ...obj,
          geometry: null, // Don't serialize the three.js geometry object directly
          stlBase64: stlService.exportObjectToBase64(obj.geometry)
        }))
      };
      
      const jsonStr = JSON.stringify(serializableState);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `stl_projekt_${new Date().getTime()}.stlc`;
      link.click();
    } catch (err: any) {
      setErrorMsg(`Fehler beim Speichern: ${err.message}`);
    }
  };

  const loadProject = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed || !parsed.objects) throw new Error("Ungültige Projektdatei");

      const reconstructedObjects = await Promise.all(parsed.objects.map(async (obj: any) => {
        if (!obj.stlBase64) throw new Error("Fehlende 3D-Daten im Projekt");
        const buffer = stlService.base64ToBuffer(obj.stlBase64);
        const geo = await stlService.loadFromBuffer(buffer);
        // Important: delete the base64 string to avoid storing huge strings in state!
        delete obj.stlBase64; 
        return {
          ...obj,
          geometry: geo
        } as SceneObject;
      }));

      pushHistory();
      setState({
        ...parsed,
        objects: reconstructedObjects
      });
    } catch (err: any) {
      setErrorMsg(`Fehler beim Laden: ${err.message}`);
    }
  };

  const handleUpdateObject = (id: string, updates: Partial<SceneObject>) => {
      setState(prev => ({
          ...prev,
          objects: prev.objects.map(o => o.id === id ? { ...o, ...updates } : o)
      }));
  };

  const handleDuplicate = (id: string) => {
      const original = state.objects.find(o => o.id === id);
      if (!original) return;
      const copy = { ...original, id: Math.random().toString(36).substr(2, 9), name: `${original.name}_Copy` };
      pushHistory();
      setState(prev => ({ ...prev, objects: [...prev.objects, copy], selectedId: copy.id }));
  };

  const handleDelete = (id: string) => {
      pushHistory();
      setState(prev => ({
          ...prev,
          objects: prev.objects.filter(o => o.id !== id),
          selectedId: prev.selectedId === id ? null : prev.selectedId
      }));
  };

  const handleExport = () => {
      const blob = stlService.exportCombined(state.objects);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `assembly_${new Date().getTime()}.stl`;
      link.click();
  };

  const handleExportSeparate = async () => {
      const visibleObjects = state.objects.filter(o => o.visible);
      if (visibleObjects.length === 0) return;
      
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      visibleObjects.forEach(obj => {
          const blob = stlService.exportCombined([obj]);
          zip.file(`${obj.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.stl`, blob);
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `parts_${new Date().getTime()}.zip`;
      link.click();
  };

  return (
    <div 
      className="flex h-screen w-screen bg-slate-950 text-slate-50 overflow-hidden relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Toast Notification for Errors */}
      {errorMsg && (
        <div className="absolute top-6 right-6 z-[110] bg-red-950/90 hover:bg-red-950 border border-red-500/50 text-red-100 text-xs px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 transition-all duration-300 animate-in fade-in slide-in-from-top-4 pointer-events-auto">
          <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="font-sans font-medium">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400 hover:text-red-200 font-bold font-mono text-sm leading-none">×</button>
        </div>
      )}

      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-blue-600/20 backdrop-blur-sm border-4 border-dashed border-blue-500 m-4 rounded-3xl pointer-events-none animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 text-white">
            <div className="bg-blue-600 p-6 rounded-full shadow-2xl animate-bounce">
              <UploadCloud size={48} />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight">Dateien hier ablegen</h2>
              <p className="text-blue-200 text-sm mt-1">STL Modelle werden automatisch zur Szene hinzugefügt</p>
            </div>
          </div>
        </div>
      )}

      <aside className="w-80 h-full bg-slate-900 border-r border-slate-800 z-10 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-600/20"><Activity size={20} /></div>
              <h1 className="font-bold text-lg tracking-tight">STL <span className="text-blue-500">Combiner</span></h1>
            </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <Controls 
            state={state}
            onSelect={(id) => setState(prev => ({ ...prev, selectedId: id }))}
            onUpdateObject={handleUpdateObject}
            onDeleteObject={handleDelete}
            onDuplicateObject={handleDuplicate}
            onMirrorObject={handleMirrorObject}
            onSliceChange={(slice) => setState(prev => ({ ...prev, slice }))}
            onBakeSlice={handleBakeSlice}
            onSplitChange={(split) => setState(prev => ({ ...prev, split }))}
            onPerformSplit={handlePerformSplit}
            onExtendChange={(extend) => setState(prev => ({ ...prev, extend }))}
            onPerformExtend={handlePerformExtend}
            onMergeObjects={handleMergeObjects}
            onViewModeChange={(mode) => setState(prev => ({ ...prev, viewMode: mode }))}
            onExportCombined={handleExport}
            onExportSeparate={handleExportSeparate}
            onSaveHistory={pushHistory}
            onAiAnalyze={async () => {
                const sel = state.objects.find(o => o.id === state.selectedId);
                if (sel) {
                    const res = await stlService.analyzeWithAI(sel.stats);
                    setState(prev => ({ ...prev, aiAnalysis: res }));
                }
            }}
          />
        </div>
      </aside>

      <main className="flex-1 relative bg-slate-950">
        <div className="absolute top-6 left-6 z-20 flex gap-4">
            <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 px-5 py-2.5 rounded-2xl shadow-2xl transition-all hover:border-blue-500/50">
                <input type="file" accept=".stl,.stlc" multiple onChange={handleFileUpload} ref={fileInputRef} className="hidden" id="stl-upload" />
                <label htmlFor="stl-upload" className="flex items-center gap-2.5 text-sm font-bold cursor-pointer text-slate-300 hover:text-white transition-all group">
                    <Upload size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    Teile hinzufügen (oder .stlc laden)
                </label>
            </div>
            
            <button 
                onClick={saveProject}
                className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 px-5 py-2.5 rounded-2xl shadow-2xl transition-all hover:border-green-500/50 text-sm font-bold text-slate-300 hover:text-white group"
            >
                <Download size={18} className="text-green-500 group-hover:scale-110 transition-transform" />
                Projekt speichern (.stlc)
            </button>

            <div className="flex items-center bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 rounded-2xl shadow-2xl p-1 overflow-hidden">
                <button 
                  onClick={handleUndo} 
                  disabled={pastObjects.length === 0}
                  title="Rückgängig"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Undo2 size={18} />
                </button>
                <div className="w-px h-6 bg-slate-800 mx-1" />
                <button 
                  onClick={handleRedo} 
                  disabled={futureObjects.length === 0}
                  title="Wiederholen"
                  className="p-2 text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  <Redo2 size={18} />
                </button>
            </div>
        </div>

        <div className="w-full h-full">
           <Viewer state={state} />
           {state.objects.length === 0 && (
               <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 pointer-events-none">
                   <div className="relative">
                       <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                       <Package size={80} className="text-slate-700 relative" />
                   </div>
                   <div className="text-center space-y-2 opacity-40">
                       <p className="text-sm font-mono tracking-widest uppercase font-bold">Assembly Area Leer</p>
                       <p className="text-xs">Ziehen Sie STL-Dateien direkt in dieses Fenster</p>
                   </div>
               </div>
           )}
        </div>

        {state.objects.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
              {isPartsMenuOpen && (
                <div className="mb-2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-2 w-56 shadow-2xl animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex flex-col gap-1 max-h-64 overflow-y-auto scrollbar-hide">
                    <button 
                      onClick={() => {
                        setState(prev => ({
                          ...prev,
                          objects: prev.objects.map(o => ({ ...o, visible: true }))
                        }));
                        setIsPartsMenuOpen(false);
                      }}
                      className="text-left px-3 py-2 text-xs text-white hover:bg-blue-600/50 rounded-lg transition-colors font-bold flex items-center justify-between"
                    >
                      Alle Einblenden
                      <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-300">{state.objects.length}</span>
                    </button>
                    <div className="h-px bg-slate-800 my-1"/>
                    {state.objects.map((obj, i) => (
                      <button
                        key={obj.id}
                        onClick={() => {
                          setState(prev => ({
                            ...prev,
                            objects: prev.objects.map(o => ({ ...o, visible: o.id === obj.id }))
                          }));
                          setIsPartsMenuOpen(false);
                        }}
                        className="text-left px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-2.5 group"
                      >
                         <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: obj.color }} />
                         <span className={`truncate flex-1 ${obj.visible ? 'text-white font-medium' : ''}`}>{obj.name || `Part ${i + 1}`}</span>
                         {!obj.visible && <span className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 font-medium">Zeigen</span>}
                         {obj.visible && <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-1.5 py-0.5 rounded">Aktiv</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-4 bg-slate-900/60 backdrop-blur-md px-6 py-2.5 rounded-full border border-slate-800/50 text-[10px] text-slate-400 font-mono shadow-xl relative mt-auto">
                 <button 
                   onClick={() => setIsPartsMenuOpen(!isPartsMenuOpen)} 
                   className="flex items-center gap-1.5 hover:text-white transition-colors cursor-pointer group"
                 >
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500 group-hover:shadow-[0_0_8px_rgba(59,130,246,0.8)] transition-all" />
                   PARTS: {state.objects.length}
                 </button>
                 <div className="w-px h-3 bg-slate-700" />
                 <span className="flex items-center gap-1.5 text-blue-300 font-bold">
                   ACTIVE: {state.objects.find(o=>o.id===state.selectedId)?.name || 'NONE'}
                 </span>
              </div>
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
