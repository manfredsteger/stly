
import React, { useState } from 'react';
import { AppState, SceneObject, SliceState, SplitState } from '../types';
import { primitiveNames, PrimitiveType } from '../services/primitiveService';
import { 
  Download, Trash2, Box, Layers, Move, RefreshCw, Scissors, Sparkles, Lock, Unlock, 
  Loader2, Minimize2, Maximize2, Eye, EyeOff, Plus, Copy, Package, Ruler, Activity
} from 'lucide-react';

interface ControlsProps {
  state: AppState;
  onSelect: (id: string | 'all' | null, multiSelect?: boolean) => void;
  onUpdateObject: (id: string, updates: Partial<SceneObject>) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  onMirrorObject: (id: string, axis: 'x' | 'y' | 'z') => void;
  onApplyScale: (id: string) => void;
  onSliceChange: (slice: SliceState) => void;
  onBakeSlice: () => void;
  onSplitChange: (split: SplitState) => void;
  onPerformSplit: () => void;
  onExtendChange: (extend: import('../types').ExtendState) => void;
  onPerformExtend: () => void;
  onMergeObjects: () => void;
  onExplodeView: () => void;
  onSubtractObjects: () => void;
  onBooleanChange: (booleanState: import('../types').BooleanState) => void;
  onPerformBoolean: () => void;
  onAddPrimitive: (type: import('../services/primitiveService').PrimitiveType) => void;
  onEraseWithObject: () => void;
  onViewModeChange: (mode: AppState['viewMode']) => void;
  onMeasureChange: (measure: import('../types').MeasureState) => void;
  onAlignChange: (align: import('../types').AlignState) => void;
  onTransformModeChange: (mode: 'translate' | 'rotate') => void;
  onSnapToEdgeChange: (snap: boolean) => void;
  onSnapCentroids: () => void;
  onGroupObjects: () => void;
  onUngroupObjects: () => void;
  onExportCombined: (format: 'stl' | 'obj' | 'gltf') => void;
  onExportAll: (format: 'stl' | 'obj' | 'gltf') => void;
  onExportSeparate: (format: 'stl' | 'obj' | 'gltf') => void;
  onAiAnalyze: () => void;
  onRepairObject: (id: string) => void;
  onSaveHistory: () => void;
}

import * as THREE from 'three';

const ControlGroup: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="mb-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50">
    <div className="flex items-center gap-2 mb-4 text-slate-300 font-semibold text-[10px] uppercase tracking-widest">
      {icon}
      <span>{title}</span>
    </div>
    {children}
  </div>
);

const Slider: React.FC<{ label: string; value: number; min: number; max: number; step?: number; color?: string; onChange: (v: number) => void; onPointerDown?: () => void }> = ({ label, value, min, max, step = 0.1, color = "accent-blue-500", onChange, onPointerDown }) => (
  <div className="mb-3">
    <div className="flex justify-between text-[10px] text-slate-400 mb-1 items-center">
      <span>{label}</span>
      <input 
        type="number"
        value={Math.round(value * 100) / 100}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        onPointerDown={onPointerDown}
        className="font-mono bg-transparent text-right outline-none w-16 appearance-none hover:bg-slate-700/50 rounded px-1"
      />
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      onPointerDown={onPointerDown}
      className={`w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer ${color}`}
    />
  </div>
);

const Controls: React.FC<ControlsProps> = (props) => {
  const { state, onSelect, onUpdateObject, onDeleteObject, onDuplicateObject, onSliceChange, onApplyScale, onBakeSlice, onSplitChange, onPerformSplit, onViewModeChange, onExportCombined, onExportSeparate, onAiAnalyze, onSaveHistory, onRepairObject, onExportAll } = props;
  const [analyzing, setAnalyzing] = useState(false);
  const [exportFormat, setExportFormat] = useState<'stl' | 'obj' | 'gltf'>('stl');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const selectedObj = state.objects.find(o => o.id === state.selectedId);

  const combinedStats = React.useMemo(() => {
    if (state.selectedId !== 'all') return null;
    let triangleCount = 0;
    let volume = 0;
    const box = new THREE.Box3();
    
    state.objects.forEach(obj => {
        if (!obj.visible) return;
        triangleCount += obj.stats.triangleCount;
        volume += obj.stats.volume;
        
        let meshBox = new THREE.Box3();
        meshBox.min.copy(obj.stats.boundingBox.min);
        meshBox.max.copy(obj.stats.boundingBox.max);
        
        const mesh = new THREE.Mesh(new THREE.BufferGeometry()); // Mock geometry
        mesh.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
        mesh.rotation.set(
            THREE.MathUtils.degToRad(obj.transform.rotation.x),
            THREE.MathUtils.degToRad(obj.transform.rotation.y),
            THREE.MathUtils.degToRad(obj.transform.rotation.z)
        );
        mesh.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
        mesh.updateMatrixWorld(true);
        
        meshBox.applyMatrix4(mesh.matrixWorld);
        box.union(meshBox);
    });
    
    const size = new THREE.Vector3();
    if (!box.isEmpty()) box.getSize(size);
    
    return {
      triangleCount,
      volume,
      size
    };
  }, [state.selectedId, state.objects]);

  return (
    <div className="flex flex-col h-full overflow-y-auto px-4 py-6 scrollbar-hide">
      
      {/* 1. SCENE TREE / OBJECTS */}
      <ControlGroup title="Scene Explorer" icon={<Package size={14} />}>
        <div className="space-y-2 max-h-48 overflow-y-auto mb-4 pr-1 scrollbar-hide">
          {state.objects.length > 1 && (
            <div 
              onClick={() => onSelect('all')}
              className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                state.selectedId === 'all' ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-900/30 border-transparent hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Layers size={14} className={state.selectedId === 'all' ? 'text-blue-400' : 'text-slate-500'} />
                <span className={`text-[11px] truncate ${state.selectedId === 'all' ? 'text-blue-100 font-bold' : 'text-slate-400'}`}>
                  Alle Objekte {state.objects.some(o => !o.visible) ? '(Nur sichtbare)' : ''}
                </span>
              </div>
            </div>
          )}
          {state.objects.map(obj => (
            <div 
              key={obj.id} 
              onClick={(e) => onSelect(obj.id, e.shiftKey || e.ctrlKey || e.metaKey)}
              className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer border transition-all ${
                (state.selectedIds || []).includes(obj.id) ? 'bg-blue-600/20 border-blue-500/50' : 'bg-slate-900/30 border-transparent hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Box size={14} className={(state.selectedIds || []).includes(obj.id) ? 'text-blue-400' : 'text-slate-500'} />
                
                {editingId === obj.id ? (
                    <input 
                        type="text" 
                        value={editingName} 
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => {
                            if (editingName.trim() && editingName.trim() !== obj.name) {
                                props.onUpdateObject(obj.id, { name: editingName.trim() });
                            }
                            setEditingId(null);
                        }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') {
                                if (editingName.trim() && editingName.trim() !== obj.name) {
                                    props.onUpdateObject(obj.id, { name: editingName.trim() });
                                }
                                setEditingId(null);
                            } else if (e.key === 'Escape') {
                                setEditingId(null);
                            }
                        }}
                        className="bg-slate-800 text-[11px] text-white px-1 py-0.5 rounded outline-none border border-blue-500 w-full"
                    />
                ) : (
                    <span 
                        onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(obj.id);
                            setEditingName(obj.name);
                        }}
                        className={`text-[11px] truncate cursor-text ${(state.selectedIds || []).includes(obj.id) ? 'text-blue-100 font-bold' : (!obj.visible ? 'text-slate-600 line-through' : 'text-slate-400')}`}
                        title="Klicken zum Umbenennen"
                    >
                        {obj.name}
                    </span>
                )}

              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={(e) => { e.stopPropagation(); onUpdateObject(obj.id, { visible: !obj.visible }); }} className="p-1 hover:text-white text-slate-500">
                    {obj.visible ? <Eye size={12}/> : <EyeOff size={12}/>}
                 </button>
                 
                 <button onClick={(e) => { e.stopPropagation(); props.onUpdateObject(obj.id, { locked: !obj.locked }); }} className={`p-1 hover:text-white ${obj.locked ? 'text-amber-500' : 'text-slate-500'}`}>
                    {obj.locked ? <Lock size={12}/> : <Unlock size={12}/>}
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); props.onDuplicateObject(obj.id); }} className="p-1 hover:text-white text-slate-500">

                    <Copy size={12}/>
                 </button>
                 <button onClick={(e) => { e.stopPropagation(); onDeleteObject(obj.id); }} className="p-1 hover:text-red-400 text-slate-500">
                    <Trash2 size={12}/>
                 </button>
              </div>
            </div>
          ))}
          {state.objects.length === 0 && <p className="text-[10px] text-slate-600 italic text-center py-2">Keine Objekte vorhanden</p>}
        </div>
        
        {state.aiAnalysis && (
            <div className="p-2 bg-blue-900/20 border border-blue-800/30 rounded-lg text-[10px] text-blue-200 mb-2 italic">
                {state.aiAnalysis}
            </div>
        )}
        <button 
          disabled={!selectedObj || analyzing}
          onClick={async () => { setAnalyzing(true); await onAiAnalyze(); setAnalyzing(false); }}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-[9px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
        >
          {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          KI Druck-Check
        </button>
        <button 
          disabled={!selectedObj}
          onClick={() => { if (selectedObj) onRepairObject(selectedObj.id); }}
          className="w-full mt-2 py-2 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-[9px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-white"
        >
          <Activity size={12} />
          Mesh Reparieren (Manifold-Check)
        </button>
      </ControlGroup>

      {/* NEW: PRIMITIVES */}
      <ControlGroup title="Formen einfügen (Radiergummi/CSG)" icon={<Plus size={14} />}>
        <div className="grid grid-cols-2 gap-1 max-h-32 overflow-y-auto pr-1 scrollbar-hide">
            {(Object.keys(primitiveNames) as PrimitiveType[]).map(type => (
                <button
                    key={type}
                    onClick={() => props.onAddPrimitive(type)}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[9px] text-left transition-colors truncate"
                    title={primitiveNames[type]}
                >
                    + {primitiveNames[type]}
                </button>
            ))}
        </div>
      </ControlGroup>

      {/* 2. TRANSFORM FOR SELECTED */}
            {(state.selectedIds || []).length >= 2 && (
        <ControlGroup title="Mehrere Objekte ausgewählt" icon={<Layers size={14} />}>
            <p className="text-[10px] text-slate-400 mb-2">
                Aktionen für mehrere ausgewählte Objekte.
            </p>
            <div className="flex flex-col gap-2">
                <button 
                    onClick={props.onGroupObjects}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
                >
                    <Package size={12} />
                    Auswahl gruppieren (schnell)
                </button>
                {(state.selectedIds || []).length === 2 && (
                  <>
                    <button 
                        onClick={props.onSnapCentroids}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2 mt-2"
                    >
                        <Move size={12} />
                        Zentren zusammenfügen
                    </button>
                    <div className="border border-slate-700/50 rounded-lg p-2 bg-slate-900/30 mt-2">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-bold text-slate-300">Boolean (CSG)</span>
                            <input 
                                type="checkbox" 
                                checked={state.boolean?.enabled || false}
                                onChange={(e) => {
                                    const selectedIds = state.selectedIds || [];
                                    props.onBooleanChange({ 
                                        ...(state.boolean || { operation: 'subtract', preview: true }), 
                                        enabled: e.target.checked,
                                        targetId: selectedIds[0],
                                        cutterId: selectedIds[1]
                                    });
                                }}
                                className="accent-blue-500 cursor-pointer"
                            />
                        </div>
                        {state.boolean?.enabled && (
                            <div className="flex flex-col gap-2 mt-2">
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => {
                                            const selectedIds = state.selectedIds || [];
                                            props.onBooleanChange({
                                                ...state.boolean,
                                                targetId: selectedIds[1],
                                                cutterId: selectedIds[0]
                                            });
                                        }}
                                        className="text-[9px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded w-full flex items-center justify-center gap-1"
                                    >
                                        <RefreshCw size={10} />
                                        Rollen tauschen
                                    </button>
                                </div>
                                <select 
                                    className="w-full bg-slate-950 border border-slate-700 text-[10px] text-white rounded p-1.5 focus:border-blue-500 outline-none"
                                    value={state.boolean.operation}
                                    onChange={(e) => props.onBooleanChange({ ...state.boolean, operation: e.target.value as any })}
                                >
                                    <option value="subtract">Subtraktion (Bewege 2 in 1)</option>
                                    <option value="union">Vereinigung (CSG)</option>
                                    <option value="intersect">Schnittmenge</option>
                                </select>
                                <label className="flex items-center gap-2 mt-1 cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        checked={state.boolean.preview}
                                        onChange={(e) => props.onBooleanChange({ ...state.boolean, preview: e.target.checked })}
                                        className="accent-blue-500"
                                    />
                                    <span className="text-[10px] text-slate-400">Live Vorschau</span>
                                </label>
                                <button 
                                    onClick={props.onPerformBoolean}
                                    className="w-full py-1.5 bg-red-600/80 hover:bg-red-500 rounded text-[10px] font-bold text-white mt-1 flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Scissors size={10} />
                                    Anwenden
                                </button>
                            </div>
                        )}
                    </div>
                  </>
                )}
            </div>
        </ControlGroup>
      )}

      {selectedObj && (state.selectedIds || []).length <= 1 && (
        <ControlGroup title={`Transform: ${selectedObj.name}`} icon={<Move size={14} />}>
           
           
           {selectedObj.originalParts && selectedObj.originalParts.length > 0 && (
             <div className="mb-3">
               <button 
                  onClick={props.onUngroupObjects}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-2"
               >
                  <Package size={12} />
                  Gruppierung aufheben
               </button>
             </div>
           )}
           
           {selectedObj.locked && (
             <div className="mb-3 p-2 bg-amber-900/20 border border-amber-800/50 rounded-lg text-[10px] text-amber-200 flex items-center justify-center gap-2">
                <Lock size={12} />
                Objekt ist gesperrt.
             </div>
           )}
           <div className={`flex bg-slate-900/50 p-1 rounded-lg gap-1 border border-slate-700/30 mb-3 ${selectedObj.locked ? 'opacity-50 pointer-events-none' : ''}`}>


              <button onClick={() => props.onTransformModeChange('translate')} className={`flex-1 py-1 rounded text-[9px] font-bold ${state.transformMode==='translate' ? 'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>VERSCHIEBEN</button>
              <button onClick={() => props.onTransformModeChange('rotate')} className={`flex-1 py-1 rounded text-[9px] font-bold ${state.transformMode==='rotate' ? 'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>DREHEN</button>
              <button onClick={() => props.onTransformModeChange('scale')} className={`flex-1 py-1 rounded text-[9px] font-bold ${state.transformMode==='scale' ? 'bg-blue-600 text-white':'text-slate-500 hover:text-slate-300'}`}>SKALIEREN</button>
           </div>
           
           {state.transformMode === 'translate' && (
              <div className="flex items-center justify-between mb-4 p-2 bg-slate-800/50 rounded-lg">
                 <span className="text-[10px] text-amber-400 font-medium">Magnetisch an andere Kanten (Snap)</span>
                 <button 
                     onClick={() => props.onSnapToEdgeChange(!state.snapToEdge)}
                     className={`w-6 h-3 rounded-full transition-colors relative ${state.snapToEdge ? 'bg-amber-600' : 'bg-slate-700'}`}
                 >
                     <div className={`absolute top-0.5 w-2 h-2 bg-white rounded-full transition-all ${state.snapToEdge ? 'left-3.5' : 'left-0.5'}`} />
                 </button>
              </div>
           )}

           <div className="mb-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <span className="text-[10px] text-slate-400 font-bold mb-1 block">Größe (mm) / Skalierung</span>
              <div className="grid grid-cols-3 gap-1">
                  <label className="flex flex-col">
                      <span className="text-[8px] text-slate-500">X (Breite)</span>
                      <input type="number" step="0.1" 
                             value={(selectedObj.stats.boundingBox.size.x * selectedObj.transform.scale.x).toFixed(2)}
                             onChange={(e) => {
                                 const v = parseFloat(e.target.value);
                                 if (!isNaN(v) && v > 0) {
                                     onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, x: v / (selectedObj.stats.boundingBox.size.x || 1) } } });
                                 }
                             }}
                             className="bg-slate-800 text-[10px] text-slate-200 p-1 rounded border border-slate-700 w-full" />
                  </label>
                  <label className="flex flex-col">
                      <span className="text-[8px] text-slate-500">Y (Höhe)</span>
                      <input type="number" step="0.1" 
                             value={(selectedObj.stats.boundingBox.size.y * selectedObj.transform.scale.y).toFixed(2)}
                             onChange={(e) => {
                                 const v = parseFloat(e.target.value);
                                 if (!isNaN(v) && v > 0) {
                                     onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, y: v / (selectedObj.stats.boundingBox.size.y || 1) } } });
                                 }
                             }}
                             className="bg-slate-800 text-[10px] text-slate-200 p-1 rounded border border-slate-700 w-full" />
                  </label>
                  <label className="flex flex-col">
                      <span className="text-[8px] text-slate-500">Z (Tiefe/Dicke)</span>
                      <input type="number" step="0.1" 
                             value={(selectedObj.stats.boundingBox.size.z * selectedObj.transform.scale.z).toFixed(2)}
                             onChange={(e) => {
                                 const v = parseFloat(e.target.value);
                                 if (!isNaN(v) && v > 0) {
                                     onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, z: v / (selectedObj.stats.boundingBox.size.z || 1) } } });
                                 }
                             }}
                             className="bg-slate-800 text-[10px] text-slate-200 p-1 rounded border border-slate-700 w-full" />
                  </label>
              </div>
           </div>
           <div className="grid grid-cols-2 gap-x-2">
              <Slider label="Pos X" value={selectedObj.transform.position.x} min={-200} max={200} 
                 onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, x: v } } })} />
              <Slider label="Pos Y" value={selectedObj.transform.position.y} min={-200} max={200} 
                 onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, y: v } } })} />
           </div>
           <Slider label="Pos Z" value={selectedObj.transform.position.z} min={-200} max={200} 
              onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, z: v } } })} />
           <div className="grid grid-cols-2 gap-x-2">
              <Slider label="Rotation X" value={selectedObj.transform.rotation.x} min={-180} max={180} 
                 onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, x: v } } })} />
              <Slider label="Rotation Y" value={selectedObj.transform.rotation.y} min={-180} max={180} 
                 onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, y: v } } })} />
           </div>
           <Slider label="Rotation Z" value={selectedObj.transform.rotation.z} min={-180} max={180} 
              onPointerDown={onSaveHistory} onChange={(v) => onUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, z: v } } })} />
           
           <div className="mt-3">
             <button 
               onClick={props.onEraseWithObject}
               className="w-full py-2 bg-rose-600/80 hover:bg-rose-500 rounded-lg text-[10px] font-bold text-white transition-all flex items-center justify-center gap-2 border border-rose-500/50"
             >
               <Scissors size={12} />
               Als Radiergummi (aus allen anderen ausschneiden)
             </button>
           </div>

           <div className="mt-3">
               <span className="text-[10px] text-slate-500 font-semibold mb-2 block uppercase tracking-wider">Geometrie anpassen (Bake)</span>
               <div className="grid grid-cols-4 gap-2">
                   <button onClick={() => props.onMirrorObject(selectedObj.id, 'x')} className="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-300 font-bold border border-slate-700 transition-colors">Mirror X</button>
                   <button onClick={() => props.onMirrorObject(selectedObj.id, 'y')} className="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-300 font-bold border border-slate-700 transition-colors">Mirror Y</button>
                   <button onClick={() => props.onMirrorObject(selectedObj.id, 'z')} className="py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] text-slate-300 font-bold border border-slate-700 transition-colors">Mirror Z</button>
                   <button onClick={() => props.onApplyScale(selectedObj.id)} disabled={selectedObj.transform.scale.x === 1 && selectedObj.transform.scale.y === 1 && selectedObj.transform.scale.z === 1} className="py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-[10px] text-white font-bold border border-blue-500 transition-colors" title="Skalierung in Geometrie einrechnen">Scale</button>
               </div>
           </div>

           <div className="border-t border-slate-700/50 pt-3 mt-3 grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                 <span className="text-slate-500 block mb-0.5">Dreiecke</span>
                 <span className="font-mono text-slate-300 font-semibold">{selectedObj.stats.triangleCount.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                 <span className="text-slate-500 block mb-0.5">Volumen</span>
                 <span className="font-mono text-slate-300 font-semibold">{(selectedObj.stats.volume / 1000).toFixed(2)} cm³</span>
              </div>
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800 col-span-2">
                 <span className="text-slate-500 block mb-0.5">Maße (X × Y × Z)</span>
                 <span className="font-mono text-slate-300 font-semibold text-[11px]">
                    {(selectedObj.stats.boundingBox.size.x * selectedObj.transform.scale.x).toFixed(1)} × {(selectedObj.stats.boundingBox.size.y * selectedObj.transform.scale.y).toFixed(1)} × {(selectedObj.stats.boundingBox.size.z * selectedObj.transform.scale.z).toFixed(1)} mm
                 </span>
              </div>
           </div>
        </ControlGroup>
      )}

      {combinedStats && (
        <ControlGroup title="Gesamtabmessungen (Alle Bauteile)" icon={<Layers size={14} />}>
           <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                 <span className="text-slate-500 block mb-0.5">Dreiecke</span>
                 <span className="font-mono text-slate-300 font-semibold">{combinedStats.triangleCount.toLocaleString()}</span>
              </div>
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800">
                 <span className="text-slate-500 block mb-0.5">Volumen</span>
                 <span className="font-mono text-slate-300 font-semibold">{(combinedStats.volume / 1000).toFixed(2)} cm³</span>
              </div>
              <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800 col-span-2">
                 <span className="text-slate-500 block mb-0.5">Gesamtmaße (X × Y × Z)</span>
                 <span className="font-mono text-slate-300 font-semibold text-[11px]">
                    {combinedStats.size.x.toFixed(1)} × {combinedStats.size.y.toFixed(1)} × {combinedStats.size.z.toFixed(1)} mm
                 </span>
              </div>
           </div>

           
           <div className="mt-4 pt-4 border-t border-slate-700/50">
               <button 
                  onClick={props.onExplodeView}
                  disabled={state.objects.filter(o => o.visible).length < 2 || analyzing}
                  className="w-full py-2.5 mb-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-colors"
               >
                 <Sparkles size={14} />
                 Explosionsansicht (Sichtbare)
               </button>
               <button 
 
                  onClick={props.onMergeObjects}
                  disabled={state.objects.filter(o => o.visible).length < 2 || analyzing}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-colors"
               >
                 <Layers size={14} />
                 Sichtbare Objekte Fusionieren
               </button>
               {state.objects.filter(o => o.visible).length < 2 && (
                  <p className="text-[9px] text-slate-500 text-center mt-2">
                     Erfordert mindestens 2 sichtbare Objekte.
                  </p>
               )}
           </div>
        </ControlGroup>
      )}

      {/* 3. SLICING / COMBINER TOOLS */}
      {selectedObj && (
        <ControlGroup title="Multi-Slicer" icon={<Scissors size={14} />}>
          <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-slate-300 font-medium">Slicing Vorschau</span>
              <button 
                  onClick={() => onSliceChange({ ...state.slice, enabled: !state.slice?.enabled })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${state.slice?.enabled ? 'bg-blue-600' : 'bg-slate-700'}`}
              >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.slice?.enabled ? 'left-4.5' : 'left-0.5'}`} />
              </button>
          </div>

          {state.slice?.enabled && (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
               <div className="flex bg-slate-900/50 p-1 rounded-lg gap-1 border border-slate-700/30">
                  <button onClick={() => onSliceChange({...state.slice, mode: 'single'})} className={`flex-1 py-1 rounded text-[9px] font-bold ${state.slice.mode==='single' ? 'bg-blue-600 text-white':'text-slate-500'}`}>EINZEL</button>
                  <button onClick={() => onSliceChange({...state.slice, mode: 'window'})} className={`flex-1 py-1 rounded text-[9px] font-bold ${state.slice.mode==='window' ? 'bg-blue-600 text-white':'text-slate-500'}`}>FENSTER</button>
               </div>
               
               <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <Slider label="Position X" value={state.slice.position.x} min={-100} max={100} onChange={v => onSliceChange({...state.slice, position: {...state.slice.position, x: v}})} />
                  <Slider label="Position Y" value={state.slice.position.y} min={-100} max={100} onChange={v => onSliceChange({...state.slice, position: {...state.slice.position, y: v}})} />
                  <Slider label="Position Z" value={state.slice.position.z} min={-100} max={100} onChange={v => onSliceChange({...state.slice, position: {...state.slice.position, z: v}})} />
                  
                  <div className="mt-3 border-t border-slate-700/50 pt-3">
                     <Slider label="Winkel X" value={state.slice.rotation.x} min={-180} max={180} onChange={v => onSliceChange({...state.slice, rotation: {...state.slice.rotation, x: v}})} />
                     <Slider label="Winkel Y" value={state.slice.rotation.y} min={-180} max={180} onChange={v => onSliceChange({...state.slice, rotation: {...state.slice.rotation, y: v}})} />
                     <Slider label="Winkel Z" value={state.slice.rotation.z} min={-180} max={180} onChange={v => onSliceChange({...state.slice, rotation: {...state.slice.rotation, z: v}})} />
                  </div>

                  {state.slice.mode === 'window' && (
                     <div className="mt-3 border-t border-slate-700/50 pt-3">
                        <Slider label="Fenster Größe" value={state.slice.windowSize} min={1} max={100} onChange={v => onSliceChange({...state.slice, windowSize: v})} />
                     </div>
                  )}
               </div>

               <button 
                onClick={onBakeSlice}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
               >
                 <Plus size={14} /> Schnitt als neues Teil hinzufügen
               </button>
            </div>
          )}
        </ControlGroup>
      )}

      {/* 4. VERLÄNGERUNG */}
      {selectedObj && (
        <ControlGroup title="Verlängerung (Extrude)" icon={<Move size={14} />}>
          <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-slate-300 font-medium">Verlängerungs-Modus</span>
              <button 
                  onClick={() => props.onExtendChange({ ...state.extend, enabled: !state.extend?.enabled })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${state.extend?.enabled ? 'bg-orange-600' : 'bg-slate-700'}`}
              >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.extend?.enabled ? 'left-4.5' : 'left-0.5'}`} />
              </button>
          </div>

          {state.extend?.enabled && (
             <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <Slider label="Verlängerung (mm)" value={state.extend.amount} min={1} max={200} onChange={v => props.onExtendChange({...state.extend, amount: v})} />
                  
                  <div className="mt-3 border-t border-slate-700/50 pt-3">
                     <Slider label="Position X" value={state.extend.position.x} min={-100} max={100} onChange={v => props.onExtendChange({...state.extend, position: {...state.extend.position, x: v}})} />
                     <Slider label="Position Y" value={state.extend.position.y} min={-100} max={100} onChange={v => props.onExtendChange({...state.extend, position: {...state.extend.position, y: v}})} />
                     <Slider label="Position Z" value={state.extend.position.z} min={-100} max={100} onChange={v => props.onExtendChange({...state.extend, position: {...state.extend.position, z: v}})} />
                  </div>
                  
                  <div className="mt-3 border-t border-slate-700/50 pt-3">
                     <Slider label="Winkel X" value={state.extend.rotation.x} min={-180} max={180} onChange={v => props.onExtendChange({...state.extend, rotation: {...state.extend.rotation, x: v}})} />
                     <Slider label="Winkel Y" value={state.extend.rotation.y} min={-180} max={180} onChange={v => props.onExtendChange({...state.extend, rotation: {...state.extend.rotation, y: v}})} />
                     <Slider label="Winkel Z" value={state.extend.rotation.z} min={-180} max={180} onChange={v => props.onExtendChange({...state.extend, rotation: {...state.extend.rotation, z: v}})} />
                  </div>
               </div>

               <button 
                onClick={props.onPerformExtend}
                className="w-full py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
               >
                 <Sparkles size={14} /> Verlängerung Anwenden
               </button>
            </div>
          )}
        </ControlGroup>
      )}

      {/* 5. VERBINDUNGEN / SPLIT */}
      {selectedObj && (
        <ControlGroup title="Steckverbindungen (Split & Join)" icon={<RefreshCw size={14} />}>
          <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] text-slate-300 font-medium">Split-Modus</span>
              <button 
                  onClick={() => onSplitChange({ ...state.split, enabled: !state.split?.enabled })}
                  className={`w-8 h-4 rounded-full transition-colors relative ${state.split?.enabled ? 'bg-purple-600' : 'bg-slate-700'}`}
              >
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.split?.enabled ? 'left-4.5' : 'left-0.5'}`} />
              </button>
          </div>

          {state.split?.enabled && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
               <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <Slider label="Position X" value={state.split.position.x} min={-100} max={100} onChange={v => onSplitChange({...state.split, position: {...state.split.position, x: v}})} />
                  <Slider label="Position Y" value={state.split.position.y} min={-100} max={100} onChange={v => onSplitChange({...state.split, position: {...state.split.position, y: v}})} />
                  <Slider label="Position Z" value={state.split.position.z} min={-100} max={100} onChange={v => onSplitChange({...state.split, position: {...state.split.position, z: v}})} />
                  
                  <div className="mt-3 border-t border-slate-700/50 pt-3">
                     <Slider label="Winkel X" value={state.split.rotation.x} min={-180} max={180} onChange={v => onSplitChange({...state.split, rotation: {...state.split.rotation, x: v}})} />
                     <Slider label="Winkel Y" value={state.split.rotation.y} min={-180} max={180} onChange={v => onSplitChange({...state.split, rotation: {...state.split.rotation, y: v}})} />
                     <Slider label="Winkel Z" value={state.split.rotation.z} min={-180} max={180} onChange={v => onSplitChange({...state.split, rotation: {...state.split.rotation, z: v}})} />
                  </div>
               </div>

               <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                  <div className="text-[10px] text-slate-400 mb-2 font-semibold">Verbindungstyp</div>
                  <div className="grid grid-cols-3 gap-1 mb-3">
                     <button onClick={() => onSplitChange({...state.split, jointType: 'flat'})} className={`py-1.5 text-[8px] font-bold rounded ${state.split.jointType==='flat'?'bg-purple-600 text-white':'bg-slate-700 text-slate-400'}`}>GLATT</button>
                     <button onClick={() => onSplitChange({...state.split, jointType: 'dovetail'})} className={`py-1.5 text-[8px] font-bold rounded ${state.split.jointType==='dovetail'?'bg-purple-600 text-white':'bg-slate-700 text-slate-400'}`}>DOVETAIL</button>
                     <button onClick={() => onSplitChange({...state.split, jointType: 'puzzle'})} className={`py-1.5 text-[8px] font-bold rounded ${state.split.jointType==='puzzle'?'bg-purple-600 text-white':'bg-slate-700 text-slate-400'}`}>PUZZLE</button>
                  </div>
                  
                  {state.split.jointType !== 'flat' && (
                     <>
                        <Slider label="Joint Breite" value={state.split.jointSize} min={2} max={30} onChange={v => onSplitChange({...state.split, jointSize: v})} />
                        <Slider label="Joint Tiefe" value={state.split.jointDepth} min={2} max={30} onChange={v => onSplitChange({...state.split, jointDepth: v})} />
                     </>
                  )}
               </div>

               <button 
                onClick={onPerformSplit}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
               >
                 <Scissors size={14} /> Teil trennen (CSG)
               </button>
            </div>
          )}
        </ControlGroup>
      )}

      {/* 5. MEASURE */}
      <ControlGroup title="Messen" icon={<Ruler size={14} />}>
        <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-slate-300 font-medium">Distanz messen</span>
            <button 
                onClick={() => props.onMeasureChange({ ...state.measure, enabled: !state.measure?.enabled, p1: null, p2: null })}
                className={`w-8 h-4 rounded-full transition-colors relative ${state.measure?.enabled ? 'bg-cyan-600' : 'bg-slate-700'}`}
            >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.measure?.enabled ? 'left-4.5' : 'left-0.5'}`} />
            </button>
        </div>
        {state.measure?.enabled && (
           <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
             <div className="p-3 bg-slate-900/30 rounded-lg border border-slate-700/30">
                <p className="text-[10px] text-slate-400 mb-2">
                  Klicken Sie auf zwei Punkte im 3D-Modell, um die Distanz zu messen.
                </p>
                {state.measure?.p1 && state.measure?.p2 && (() => {
                   const dist = Math.sqrt(
                     Math.pow(state.measure.p2.x - state.measure.p1.x, 2) +
                     Math.pow(state.measure.p2.y - state.measure.p1.y, 2) +
                     Math.pow(state.measure.p2.z - state.measure.p1.z, 2)
                   );
                   const displayDist = state.measure.unit === 'in' ? (dist / 25.4) : dist;
                   return (
                    <div className="mt-3 border-t border-slate-700/50 pt-3">
                       <div className="flex justify-between items-center mb-1">
                         <span className="text-slate-500 block text-[10px]">Euklidische Distanz</span>
                         <div className="flex bg-slate-800 rounded p-0.5">
                           <button onClick={() => props.onMeasureChange({...state.measure, unit: 'mm'})} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${state.measure.unit==='mm' ? 'bg-cyan-600 text-white':'text-slate-400 hover:text-slate-200'}`}>MM</button>
                           <button onClick={() => props.onMeasureChange({...state.measure, unit: 'in'})} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${state.measure.unit==='in' ? 'bg-cyan-600 text-white':'text-slate-400 hover:text-slate-200'}`}>IN</button>
                         </div>
                       </div>
                       <span className="font-mono text-cyan-400 font-semibold text-lg">
                         {displayDist.toFixed(2)} {state.measure.unit === 'in' ? 'in' : 'mm'}
                       </span>
                    </div>
                   );
                })()}
             </div>
           </div>
        )}
      </ControlGroup>

      {/* ALIGN / SNAP */}
      <ControlGroup title="Ausrichten" icon={<Move size={14} />}>
        <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] text-slate-300 font-medium">Flächen verbinden</span>
            <button 
                onClick={() => props.onAlignChange({ enabled: !state.align?.enabled, step: 'select_source' })}
                className={`w-8 h-4 rounded-full transition-colors relative ${state.align?.enabled ? 'bg-amber-600' : 'bg-slate-700'}`}
            >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${state.align?.enabled ? 'left-4.5' : 'left-0.5'}`} />
            </button>
        </div>
        {state.align?.enabled && (
           <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
             <div className="p-3 bg-slate-900/30 rounded-lg border border-amber-500/30">
                <p className="text-[10px] text-slate-400 mb-2">
                  {state.align.step === 'select_source' ? (
                    <><strong className="text-amber-400">1. Start:</strong> Klicken Sie auf eine ebene Fläche eines Objekts.</>
                  ) : (
                    <><strong className="text-amber-400">2. Ziel:</strong> Klicken Sie auf eine ebene Fläche des Ziels.</>
                  )}
                </p>
                {state.align.step === 'select_target' && (
                  <button onClick={() => props.onAlignChange({ enabled: true, step: 'select_source' })} className="mt-2 text-[10px] text-amber-500 hover:text-amber-400">
                    Zurücksetzen
                  </button>
                )}
             </div>
           </div>
        )}
      </ControlGroup>

      {/* 6. DARSTELLUNG */}
      <ControlGroup title="Visuals" icon={<Layers size={14} />}>
        <div className="grid grid-cols-4 gap-1">
          {(['solid', 'wireframe', 'points', 'transparent'] as const).map(m => (
            <button key={m} onClick={() => onViewModeChange(m)} className={`py-1.5 text-[8px] font-bold uppercase rounded border ${state.viewMode===m ? 'bg-blue-600 border-blue-500 text-white':'bg-slate-700 border-slate-600 text-slate-400'}`}>
              {m}
            </button>
          ))}
        </div>
      </ControlGroup>

      <div className="mt-auto pt-6 space-y-2">
        <div className="flex gap-1 mb-2 bg-slate-800 p-1 rounded-lg">
          {(['stl', 'obj', 'gltf'] as const).map(fmt => (
            <button key={fmt} onClick={() => setExportFormat(fmt)} className={`flex-1 py-1 text-[9px] font-bold uppercase rounded ${exportFormat === fmt ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}>
              {fmt === 'gltf' ? 'GLB' : fmt}
            </button>
          ))}
        </div>
        
        <button 
          disabled={state.objects.length === 0}
          onClick={() => onExportAll(exportFormat)}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-[11px] shadow-xl shadow-purple-500/30 transition-all disabled:opacity-50"
        >
          <Download size={14} />
          Gesamte Szene ({exportFormat.toUpperCase()})
        </button>
        <button 
          disabled={state.objects.filter(o => o.visible).length === 0}

          onClick={() => onExportCombined(exportFormat)}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-[11px] shadow-xl shadow-blue-500/30 transition-all disabled:opacity-50"
        >
          <Download size={14} />
          Sichtbare als 1 {exportFormat.toUpperCase()}
        </button>
        <button 
          disabled={state.objects.filter(o => o.visible).length === 0}
          onClick={() => onExportSeparate(exportFormat)}
          className="w-full py-2.5 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-[11px] transition-all disabled:opacity-50"
        >
          <Download size={14} />
          Sichtbare einzeln (ZIP)
        </button>
      </div>
    </div>
  );
};

export default Controls;
