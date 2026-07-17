
import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Upload, Download, Box, Activity, Package, Scissors, Sparkles, Move, Layers, UploadCloud, Undo2, Redo2, Lock, Unlock, HelpCircle } from 'lucide-react';
import Viewer from './components/Viewer';
import Controls from './components/Controls';
import { HelpModal } from './components/HelpModal';
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

const validateAndRepairGeometry = (geo: THREE.BufferGeometry): THREE.BufferGeometry => {
  if (!geo || !geo.attributes.position) return geo;
  
  let nonIndexedGeo = geo.index ? geo.toNonIndexed() : geo;
  const posAttr = nonIndexedGeo.attributes.position;
  
  const validPositions: number[] = [];
  let hasNaN = false;
  let degenerateCount = 0;
  
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const v3 = new THREE.Vector3();
  
  for (let i = 0; i < posAttr.count; i += 3) {
    if (i + 2 >= posAttr.count) break;
    
    v1.fromBufferAttribute(posAttr, i);
    v2.fromBufferAttribute(posAttr, i + 1);
    v3.fromBufferAttribute(posAttr, i + 2);
    
    if (
      isNaN(v1.x) || isNaN(v1.y) || isNaN(v1.z) || !isFinite(v1.x) || !isFinite(v1.y) || !isFinite(v1.z) ||
      isNaN(v2.x) || isNaN(v2.y) || isNaN(v2.z) || !isFinite(v2.x) || !isFinite(v2.y) || !isFinite(v2.z) ||
      isNaN(v3.x) || isNaN(v3.y) || isNaN(v3.z) || !isFinite(v3.x) || !isFinite(v3.y) || !isFinite(v3.z)
    ) {
      hasNaN = true;
      continue;
    }
    
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const cross = new THREE.Vector3().crossVectors(edge1, edge2);
    
    if (cross.lengthSq() < 1e-10) {
       degenerateCount++;
       continue;
    }
    
    validPositions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
  }
  
  if (hasNaN || degenerateCount > 0) {
    console.warn(`Filtered ${degenerateCount} degenerate triangles and NaN vertices.`);
  }
  
  const newGeo = new THREE.BufferGeometry();
  if (validPositions.length > 0) {
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(validPositions, 3));
    newGeo.computeVertexNormals();
    newGeo.computeBoundingBox();
    newGeo.computeBoundingSphere();
  } else {
    // Provide a safe empty geometry
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    newGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
    newGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
  }
  return newGeo;
};

const INITIAL_MEASURE = {
  enabled: false,
  p1: null,
  p2: null,
  unit: 'mm' as const,
};

const INITIAL_BOOLEAN = {
  enabled: false,
  operation: 'subtract' as const,
  targetId: null,
  cutterId: null,
  preview: true
};

const INITIAL_STATE: AppState = {
  objects: [],
  selectedIds: [],
  selectedId: null,
  slice: INITIAL_SLICE,
  split: INITIAL_SPLIT,
  extend: INITIAL_EXTEND,
  measure: INITIAL_MEASURE,
  align: { enabled: false, step: 'select_source' },
  boolean: INITIAL_BOOLEAN,
  viewMode: 'solid',
  globalColor: '#3b82f6',
  transformMode: 'translate',
  snapToEdge: false,
};

const DimensionInput = ({ value, onChange, label }: { value: number, onChange: (v: number) => void, label: string }) => {
  const [strValue, setStrValue] = useState(value.toFixed(2));
  
  useEffect(() => {
    if (Math.abs(parseFloat(strValue) - value) > 0.001) {
      setStrValue(value.toFixed(2));
    }
  }, [value]);

  return (
    <div>
      <span className="text-[8px] text-slate-500 block">{label}</span>
      <input 
        type="text" 
        value={strValue}
        onChange={(e) => {
          let val = e.target.value.replace(',', '.');
          if (/^-?\d*\.?\d*$/.test(val)) {
            setStrValue(val);
            const num = parseFloat(val);
            if (!isNaN(num)) onChange(num);
          }
        }}
        onBlur={() => setStrValue(value.toFixed(2))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            setStrValue(value.toFixed(2));
          }
        }}
        className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono focus:outline-none focus:border-blue-500"
      />
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(INITIAL_STATE);
  const [uniformScale, setUniformScale] = useState(true);
  const [pastObjects, setPastObjects] = useState<SceneObject[][]>([]);
  const [futureObjects, setFutureObjects] = useState<SceneObject[][]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPartsMenuOpen, setIsPartsMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [loadingText, setLoadingText] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; objectId: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isProcessing && loadingProgress !== null && loadingProgress > 0 && loadingProgress < 90) {
      timer = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev === null) return null;
          // Asymptotic progress towards 90%
          const remaining = 90 - prev;
          const step = Math.max(0.5, remaining * 0.05);
          return Math.min(90, prev + step);
        });
      }, 500);
    }
    return () => clearInterval(timer);
  }, [isProcessing, loadingProgress]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

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

const getHighContrastColor = (): string => {
  const isDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const darkColors = ['#38bdf8', '#f87171', '#34d399', '#fbbf24', '#a78bfa', '#f472b6', '#e2e8f0'];
  const lightColors = ['#0284c7', '#dc2626', '#059669', '#d97706', '#7c3aed', '#db2777', '#475569'];
  const palette = isDark ? darkColors : lightColors;
  return palette[Math.floor(Math.random() * palette.length)];
};



  
  const processFile = async (file: File) => {
    setErrorMsg(null);
    setIsProcessing(true);
    setLoadingText(`Lade ${file.name}...`);
    setLoadingProgress(0);
    const progressTimer = setInterval(() => {
        setLoadingProgress(prev => {
            if (prev === null) return null;
            if (prev >= 95) return prev;
            return prev + Math.max(0.1, (95 - prev) * 0.05);
        });
    }, 500);

    try {

        if (file.name.toLowerCase().endsWith('.stlc')) {
          await loadProject(file);
          return;
        }
        
        let buffer: ArrayBuffer;
        
        
        if (file.name.toLowerCase().endsWith('.scad')) {
          setLoadingText(`Kompiliere ${file.name} (OpenSCAD)...`);
          try {
            const scadCode = await file.text();
            const response = await fetch('/api/compile-scad', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scadCode })
            });
            
            if (!response.ok) {
              let errorMsg = `HTTP Error ${response.status}`;
              try {
                  const errorData = await response.json();
                  errorMsg = errorData.error || errorMsg;
              } catch(e) {}
              throw new Error(errorMsg);
            }
            
            buffer = await response.arrayBuffer();
          } catch (err: any) {
            console.error("Error compiling SCAD:", err);
            setErrorMsg(`Fehler beim Kompilieren von "${file.name}": ${err.message || err.toString()}`);
            return;
          }
        } else if (file.name.toLowerCase().endsWith('.stl')) {

          buffer = await file.arrayBuffer();
        } else {
          return;
        }
        
        setLoadingText(`Importiere ${file.name}...`);
        let geo = await stlService.loadFromBuffer(buffer);
        
        geo = validateAndRepairGeometry(geo);
        
        if (!geo || !geo.attributes.position || geo.attributes.position.count === 0) {
          throw new Error("Ungültige oder unvollständige STL-Geometrie.");
        }

        geo.center();
        const stats = stlService.calculateStats(geo);
        
        const newObj: SceneObject = {
          id: Math.random().toString(36).substr(2, 9),
          name: file.name.replace('.stl', '').replace('.scad', ''),
          geometry: geo,
          color: getHighContrastColor(),
          transform: {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 }
          },
          visible: true,
          stats
        };

        pushHistory();
        setState(prev => ({
          ...prev,
          objects: [...prev.objects, newObj],
          selectedId: newObj.id
        }));
    } catch (err: any) {
        console.error("Error loading file:", err);
        setErrorMsg(`Fehler beim Laden von "${file.name}": ${err.message || err.toString()}`);
    } finally {
        clearInterval(progressTimer);
        setIsProcessing(false);
        setLoadingText(null);
        setLoadingProgress(null);
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
    if (!selected || !state.slice?.enabled) return;

    try {
        const { csgService } = await import('./services/csgService');
        const newGeo = csgService.performSlice(selected, state.slice);
        if (!newGeo) return;

        const newObj: SceneObject = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${selected.name}_Slice`,
            geometry: newGeo,
            transform: { ...selected.transform },
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
      if (!selected || !state.split?.enabled) return;
      
      try {
          const { csgService } = await import('./services/csgService');
          const result = csgService.performSplit(selected, state.split);
          if (!result) return;

          const partAObj: SceneObject = {
              id: Math.random().toString(36).substr(2, 9),
              name: `${selected.name}_A`,
              geometry: result.partA,
              transform: { ...selected.transform },
              visible: true,
              color: selected.color,
              stats: stlService.calculateStats(result.partA)
          };

          const partBObj: SceneObject = {
            id: Math.random().toString(36).substr(2, 9),
            name: `${selected.name}_B`,
            geometry: result.partB,
            transform: { ...selected.transform },
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

  
  const handleRepairObject = async (id: string) => {
      const obj = state.objects.find(o => o.id === id);
      if (!obj) return;
      
      try {
          setIsProcessing(true);
          const { mergeVertices } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
          let geometry = obj.geometry;
          if (geometry.index) {
              geometry = geometry.toNonIndexed();
          }
          const repaired = mergeVertices(geometry, 1e-4);
          repaired.computeVertexNormals();
          
          pushHistory();
          const { stlService } = await import('./services/stlService');
          handleUpdateObject(id, {
              geometry: repaired,
              stats: stlService.calculateStats(repaired)
          });
      } catch (err: any) {
          console.error("Repair failed", err);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleApplyScale = (id: string) => {
      const obj = state.objects.find(o => o.id === id);
      if (!obj || obj.transform.scale.x === 1 && obj.transform.scale.y === 1 && obj.transform.scale.z === 1) return;
      
      const newGeo = obj.geometry.clone();
      newGeo.scale(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
      
      pushHistory();
      setState(prev => ({
          ...prev,
          objects: prev.objects.map(o => o.id === id ? {
              ...o,
              geometry: newGeo,
              transform: { ...o.transform, scale: { x: 1, y: 1, z: 1 } },
              stats: stlService.calculateStats(newGeo)
          } : o)
      }));
  };

  const handlePerformBoolean = async () => {
      const boolState = state.boolean;
      if (!boolState || !boolState.enabled || !boolState.targetId || !boolState.cutterId) {
          setErrorMsg("Bitte wählen Sie Ziel- und Werkzeug-Objekte aus.");
          return;
      }

      const targetObj = state.objects.find(o => o.id === boolState.targetId);
      const cutterObj = state.objects.find(o => o.id === boolState.cutterId);

      if (!targetObj || !cutterObj) return;

      setIsProcessing(true);

      try {
          // Add small delay for UI to update
          await new Promise(resolve => setTimeout(resolve, 50));
          const { csgService } = await import('./services/csgService');
          
          let resultGeo: THREE.BufferGeometry | null = null;
          
          if (boolState.operation === 'subtract') {
              resultGeo = csgService.subtractObjects(
                  targetObj.geometry, 
                  cutterObj.geometry,
                  targetObj.transform,
                  cutterObj.transform
              );
          } else if (boolState.operation === 'intersect') {
              resultGeo = csgService.intersectObjects(
                  targetObj.geometry, 
                  cutterObj.geometry,
                  targetObj.transform,
                  cutterObj.transform
              );
          } else if (boolState.operation === 'union') {
              resultGeo = csgService.unionObjects(
                  targetObj.geometry, 
                  cutterObj.geometry,
                  targetObj.transform,
                  cutterObj.transform
              );
          }

          if (!resultGeo) throw new Error("Boolean-Operation fehlgeschlagen.");

          pushHistory();

          let opName = 'Ausgeschnitten';
          if (boolState.operation === 'intersect') opName = 'Schnittmenge';
          if (boolState.operation === 'union') opName = 'Vereinigt';

          const newObj: SceneObject = {
              ...targetObj,
              id: Math.random().toString(36).substr(2, 9),
              name: `${targetObj.name} (${opName})`,
              geometry: resultGeo,
              stats: (await import('./services/stlService')).stlService.calculateStats(resultGeo)
          };

          setState(prev => {
              const newCutterObj = { ...cutterObj, visible: false };
              return {
                  ...prev,
                  objects: prev.objects.map(o => {
                      if (o.id === targetObj.id) return newObj;
                      if (o.id === cutterObj.id) return newCutterObj;
                      return o;
                  }),
                  selectedId: newObj.id,
                  selectedIds: [newObj.id],
                  boolean: { ...prev.boolean, enabled: false }
              };
          });
      } catch (err: any) {
          setErrorMsg(`Fehler bei Boolean-Operation: ${err.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  const handleEraseWithObject = async () => {
      const cutterId = state.selectedId;
      if (!cutterId) return;

      const cutterObj = state.objects.find(o => o.id === cutterId);
      if (!cutterObj) return;

      setIsProcessing(true);

      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const { csgService } = await import('./services/csgService');
          const { stlService } = await import('./services/stlService');

          let processedObjects = new Map<string, SceneObject | null>();
          
          for (const targetObj of state.objects) {
              if (targetObj.id === cutterId || !targetObj.visible) {
                  continue; // Skip the cutter and hidden objects
              }

              const resultGeo = csgService.subtractObjects(
                  targetObj.geometry, 
                  cutterObj.geometry,
                  targetObj.transform,
                  cutterObj.transform
              );

              if (resultGeo) {
                  if (resultGeo.attributes.position && resultGeo.attributes.position.count > 0) {
                      processedObjects.set(targetObj.id, {
                          ...targetObj,
                          id: Math.random().toString(36).substr(2, 9),
                          geometry: resultGeo,
                          stats: stlService.calculateStats(resultGeo)
                      });
                  } else {
                      // object is completely erased
                      processedObjects.set(targetObj.id, null);
                  }
              } else {
                  processedObjects.set(targetObj.id, targetObj);
              }
          }

          pushHistory();

          setState(prev => {
              const nextObjects = prev.objects.map(o => {
                  if (o.id === cutterId) return null; // remove cutter
                  if (processedObjects.has(o.id)) {
                      return processedObjects.get(o.id) as SceneObject | null;
                  }
                  return o;
              }).filter(Boolean) as SceneObject[];

              return {
                  ...prev,
                  objects: nextObjects,
                  selectedId: null,
                  selectedIds: []
              };
          });
      } catch (err: any) {
          setErrorMsg(`Fehler beim Radieren: ${err.message}`);
      } finally {
          setIsProcessing(false);
      }
  };

  
  
  const handleUngroupObjects = async () => {
      const selectedIds = state.selectedIds || [];
      if (selectedIds.length !== 1) return;
      
      const objToUngroup = state.objects.find(o => o.id === selectedIds[0]);
      if (!objToUngroup || !objToUngroup.originalParts || objToUngroup.originalParts.length === 0) return;
      
      setIsProcessing(true);
      
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const THREE = await import('three');
          
          // The group object might have been moved.
          // Its original components were stored with their world transforms at the time of grouping,
          // AND the grouped object was created at 0,0,0.
          // If the grouped object has a transform, we must apply it to the children.
          const groupMatrix = new THREE.Matrix4().compose(
              new THREE.Vector3(objToUngroup.transform.position.x, objToUngroup.transform.position.y, objToUngroup.transform.position.z),
              new THREE.Quaternion().setFromEuler(new THREE.Euler(
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.x), 
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.y), 
                  THREE.MathUtils.degToRad(objToUngroup.transform.rotation.z)
              )),
              new THREE.Vector3(objToUngroup.transform.scale.x, objToUngroup.transform.scale.y, objToUngroup.transform.scale.z)
          );

          const newObjects = objToUngroup.originalParts.map(part => {
              // Create matrix for part's original transform
              const partMatrix = new THREE.Matrix4().compose(
                  new THREE.Vector3(part.transform.position.x, part.transform.position.y, part.transform.position.z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      THREE.MathUtils.degToRad(part.transform.rotation.x), 
                      THREE.MathUtils.degToRad(part.transform.rotation.y), 
                      THREE.MathUtils.degToRad(part.transform.rotation.z)
                  )),
                  new THREE.Vector3(part.transform.scale.x, part.transform.scale.y, part.transform.scale.z)
              );
              
              // Apply group's matrix over part's matrix
              const finalMatrix = new THREE.Matrix4().multiplyMatrices(groupMatrix, partMatrix);
              
              // Decompose back to position, rotation, scale
              const position = new THREE.Vector3();
              const quaternion = new THREE.Quaternion();
              const scale = new THREE.Vector3();
              finalMatrix.decompose(position, quaternion, scale);
              const euler = new THREE.Euler().setFromQuaternion(quaternion);

              return {
                  ...part,
                  id: Math.random().toString(36).substr(2, 9), // new IDs to avoid conflicts
                  transform: {
                      position: { x: position.x, y: position.y, z: position.z },
                      rotation: { 
                          x: THREE.MathUtils.radToDeg(euler.x), 
                          y: THREE.MathUtils.radToDeg(euler.y), 
                          z: THREE.MathUtils.radToDeg(euler.z) 
                      },
                      scale: { x: scale.x, y: scale.y, z: scale.z }
                  },
                  visible: true
              };
          });

          pushHistory();
          setState(prev => {
              const newIds = newObjects.map(o => o.id);
              return {
                  ...prev,
                  objects: prev.objects.filter(o => o.id !== objToUngroup.id).concat(newObjects),
                  selectedId: newIds[0],
                  selectedIds: newIds
              };
          });
      } catch (err: any) {
          console.error("Ungroup Error:", err);
          setErrorMsg(`Fehler beim Gruppierung aufheben: ${err.message || err.toString()}`);
      } finally {
          setIsProcessing(false);
      }
  };


  const handleGroupObjects = async () => {
      const selectedIds = state.selectedIds || [];
      if (selectedIds.length < 2) return;
      
      const objectsToGroup = state.objects.filter(o => selectedIds.includes(o.id));
      
      setIsProcessing(true);
      
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const { mergeGeometries } = await import('three/examples/jsm/utils/BufferGeometryUtils.js');
          const THREE = await import('three');

          const geometries = objectsToGroup.map(obj => {
              const geo = obj.geometry.clone();
              const matrix = new THREE.Matrix4().compose(
                  new THREE.Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      THREE.MathUtils.degToRad(obj.transform.rotation.x), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.y), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.z)
                  )),
                  new THREE.Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z)
              );
              geo.applyMatrix4(matrix);
              return geo;
          });

          const mergedGeo = mergeGeometries(geometries, false);
          
          if (mergedGeo.attributes.position && mergedGeo.attributes.position.count === 0) {
              mergedGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
              mergedGeo.boundingBox = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 0));
          } else {
              mergedGeo.computeVertexNormals();
          }

          const newObj = {
              id: Math.random().toString(36).substr(2, 9),
              name: `Gruppe (${objectsToGroup.length} Teile)`,
              geometry: mergedGeo,
              transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
              visible: true,
              color: objectsToGroup[0].color || state.globalColor,
              stats: (await import('./services/stlService')).stlService.calculateStats(mergedGeo),
              originalParts: objectsToGroup
          };

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.filter(o => !selectedIds.includes(o.id)).concat([newObj]),
              selectedId: newObj.id,
              selectedIds: [newObj.id]
          }));
      } catch (err: any) {
          console.error("Group Error:", err);
          setErrorMsg(`Fehler beim Gruppieren: ${err.message || err.toString()}`);
      } finally {
          setIsProcessing(false);
      }
  };


  
  const handleExplodeView = async () => {
      const visibleObjects = state.objects.filter(o => o.visible);
      if (visibleObjects.length < 2) {
          setErrorMsg("Mindestens 2 sichtbare Objekte erforderlich.");
          return;
      }
      
      setIsProcessing(true);
      try {
          await new Promise(resolve => setTimeout(resolve, 50));
          const THREE = await import('three');
          
          let globalCenter = new THREE.Vector3();
          
          // Calculate global center of mass
          visibleObjects.forEach(obj => {
              const center = new THREE.Vector3();
              const box = new THREE.Box3();
              const geo = obj.geometry.clone();
              const matrix = new THREE.Matrix4().compose(
                  new THREE.Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z),
                  new THREE.Quaternion().setFromEuler(new THREE.Euler(
                      THREE.MathUtils.degToRad(obj.transform.rotation.x), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.y), 
                      THREE.MathUtils.degToRad(obj.transform.rotation.z)
                  )),
                  new THREE.Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z)
              );
              geo.applyMatrix4(matrix);
              geo.computeBoundingBox();
              if (geo.boundingBox) {
                  geo.boundingBox.getCenter(center);
                  globalCenter.add(center);
              }
          });
          
          globalCenter.divideScalar(visibleObjects.length);
          
          // Apply explosion offset
          const explosionDistance = 30; // 30mm base offset

          pushHistory();
          setState(prev => ({
              ...prev,
              objects: prev.objects.map(obj => {
                  if (!obj.visible) return obj;
                  
                  const center = new THREE.Vector3();
                  const geo = obj.geometry.clone();
                  const matrix = new THREE.Matrix4().compose(
                      new THREE.Vector3(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z),
                      new THREE.Quaternion().setFromEuler(new THREE.Euler(
                          THREE.MathUtils.degToRad(obj.transform.rotation.x), 
                          THREE.MathUtils.degToRad(obj.transform.rotation.y), 
                          THREE.MathUtils.degToRad(obj.transform.rotation.z)
                      )),
                      new THREE.Vector3(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z)
                  );
                  geo.applyMatrix4(matrix);
                  geo.computeBoundingBox();
                  
                  let offset = new THREE.Vector3(0, 1, 0); // Default direction
                  if (geo.boundingBox) {
                      geo.boundingBox.getCenter(center);
                      const dir = new THREE.Vector3().subVectors(center, globalCenter);
                      if (dir.lengthSq() > 0.001) {
                          dir.normalize();
                          offset = dir;
                      }
                      
                      const size = new THREE.Vector3();
                      geo.boundingBox.getSize(size);
                      
                      // Scale offset by object size + base distance
                      const maxDim = Math.max(size.x, size.y, size.z);
                      offset.multiplyScalar(explosionDistance + maxDim * 0.5);
                  }
                  
                  return {
                      ...obj,
                      transform: {
                          ...obj.transform,
                          position: {
                              x: obj.transform.position.x + offset.x,
                              y: obj.transform.position.y + offset.y,
                              z: obj.transform.position.z + offset.z
                          }
                      }
                  };
              })
          }));
      } catch (err: any) {
          console.error("Explode Error:", err);
          setErrorMsg(`Fehler bei Explosionsansicht: ${err.message || err.toString()}`);
      } finally {
          setIsProcessing(false);
      }
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
              transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
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
      if (!selected || !state.extend?.enabled) return;
      
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
        let geo = await stlService.loadFromBuffer(buffer);
        geo = validateAndRepairGeometry(geo);
        // Important: delete the base64 string to avoid storing huge strings in state!
        delete obj.stlBase64; 
        
        // Ensure valid transform
        const transform = obj.transform || {};
        const position = transform.position || {};
        const rotation = transform.rotation || {};
        const scale = transform.scale || {};
        
        return {
          ...obj,
          transform: {
            position: { x: position.x ?? 0, y: position.y ?? 0, z: position.z ?? 0 },
            rotation: { x: rotation.x ?? 0, y: rotation.y ?? 0, z: rotation.z ?? 0 },
            scale: { x: scale.x ?? 1, y: scale.y ?? 1, z: scale.z ?? 1 },
          },
          visible: obj.visible !== false,
          geometry: geo
        } as SceneObject;
      }));

      pushHistory();
      setState({
        ...INITIAL_STATE,
        ...parsed,
        objects: reconstructedObjects
      });
    } catch (err: any) {
      setErrorMsg(`Fehler beim Laden: ${err.message}`);
    }
  };

  
  const handleUpdateObjects = (updatesList: {id: string, updates: Partial<SceneObject>}[]) => {
      setState(prev => {
          const newObjects = [...prev.objects];
          let changed = false;
          updatesList.forEach(({id, updates}) => {
              const idx = newObjects.findIndex(o => o.id === id);
              if (idx !== -1) {
                  newObjects[idx] = { ...newObjects[idx], ...updates };
                  changed = true;
              }
          });
          if (!changed) return prev;
          return { ...prev, objects: newObjects };
      });
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

  const handleAddPrimitive = async (type: import('./services/primitiveService').PrimitiveType) => {
      const { primitiveService, primitiveNames } = await import('./services/primitiveService');
      const geometry = primitiveService.createPrimitive(type, 20); // Base size 20mm
      const newObj: SceneObject = {
          id: Math.random().toString(36).substr(2, 9),
          name: primitiveNames[type],
          geometry,
          transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          visible: true,
          color: '#ef4444', // Default to a reddish color to indicate cutter/eraser
          stats: await stlService.calculateStats(geometry)
      };
      pushHistory();
      setState(prev => ({
          ...prev,
          objects: [...prev.objects, newObj],
          selectedId: newObj.id,
          selectedIds: [newObj.id]
      }));
  };

  const handleExport = async (format: 'stl' | 'obj' | 'gltf') => {
      const blob = await stlService.exportCombined(state.objects, format);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const extension = format === 'gltf' ? 'glb' : format;
      link.download = `assembly_${new Date().getTime()}.${extension}`;
      link.click();
  };

  
  const handleExportAll = async (format: 'stl' | 'obj' | 'gltf') => {
      const allObjectsVisible = state.objects.map(o => ({ ...o, visible: true }));
      const blob = await stlService.exportCombined(allObjectsVisible, format);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const extension = format === 'gltf' ? 'glb' : format;
      link.download = `scene_${new Date().getTime()}.${extension}`;
      link.click();
  };

  const handleExportSeparate = async (format: 'stl' | 'obj' | 'gltf') => {
      const visibleObjects = state.objects.filter(o => o.visible);
      if (visibleObjects.length === 0) return;
      
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      for (const obj of visibleObjects) {
          const blob = await stlService.exportCombined([obj], format);
          const extension = format === 'gltf' ? 'glb' : format;
          zip.file(`${obj.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.${extension}`, blob);
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `parts_${new Date().getTime()}.zip`;
      link.click();
  };


  const handleScaleFromMeasure = (ratio: number) => {
    pushHistory();
    setState(prev => {
      // Find the object to scale. If one is selected, scale that. Otherwise scale all.
      const objectsToScale = prev.selectedId 
        ? [prev.selectedId] 
        : (prev.selectedIds?.length ? prev.selectedIds : prev.objects.map(o => o.id));
      
      const newObjects = prev.objects.map(obj => {
        if (objectsToScale.includes(obj.id)) {
          return {
            ...obj,
            transform: {
              ...obj.transform,
              scale: {
                x: obj.transform.scale.x * ratio,
                y: obj.transform.scale.y * ratio,
                z: obj.transform.scale.z * ratio,
              }
            }
          };
        }
        return obj;
      });
      
      // Also scale the measured points themselves so the visual line expands with it!
      const newMeasure = { ...prev.measure };
      if (newMeasure.p1 && newMeasure.p2 && prev.selectedId) {
        // Find the selected object before scale
        const selectedObj = prev.objects.find(o => o.id === prev.selectedId);
        if (selectedObj) {
           // We'll scale the points relative to the object's origin if we scaled the object
           // Wait, simple proportional scaling of the distance is all we need to show the new distance.
           // However, to update the exact positions of p1 and p2:
           // It's a bit complex since they might be world coordinates. We can just scale them from the origin of the selected object.
           const origin = new THREE.Vector3(selectedObj.transform.position.x, selectedObj.transform.position.y, selectedObj.transform.position.z);
           const dp1 = new THREE.Vector3(newMeasure.p1.x, newMeasure.p1.y, newMeasure.p1.z).sub(origin).multiplyScalar(ratio).add(origin);
           const dp2 = new THREE.Vector3(newMeasure.p2.x, newMeasure.p2.y, newMeasure.p2.z).sub(origin).multiplyScalar(ratio).add(origin);
           newMeasure.p1 = dp1;
           newMeasure.p2 = dp2;
        }
      }

      return {
        ...prev,
        objects: newObjects,
        measure: newMeasure
      };
    });
  };

  const handleMeasureClick = (point: THREE.Vector3) => {

    setState(prev => {
        if (!prev.measure.enabled) return prev;
        
        let newMeasure = { ...prev.measure };
        if (!newMeasure.p1 || (newMeasure.p1 && newMeasure.p2)) {
            newMeasure.p1 = point;
            newMeasure.p2 = null;
        } else if (newMeasure.p1 && !newMeasure.p2) {
            newMeasure.p2 = point;
        }
        
        return { ...prev, measure: newMeasure };
    });
  };

  const handleAlignClick = (objectId: string, point: THREE.Vector3, normal: THREE.Vector3) => {
    if (!state.align?.enabled) return;
    
    if (state.align.step === 'select_source') {
      setState(prev => ({
        ...prev,
        align: {
          ...prev.align,
          step: 'select_target',
          source: { objectId, point: { x: point.x, y: point.y, z: point.z }, normal: { x: normal.x, y: normal.y, z: normal.z } }
        }
      }));
    } else if (state.align.step === 'select_target') {
      const source = state.align.source!;
      if (!source) return;

      pushHistory();

      // target info
      const targetPoint = point;
      const targetNormal = normal;

      setState(prev => {
        const sourceObj = prev.objects.find(o => o.id === source.objectId);
        if (!sourceObj) return prev;

        const sourceGroup = new THREE.Group();
        sourceGroup.position.set(sourceObj.transform.position.x, sourceObj.transform.position.y, sourceObj.transform.position.z);
        sourceGroup.rotation.set(
            THREE.MathUtils.degToRad(sourceObj.transform.rotation.x),
            THREE.MathUtils.degToRad(sourceObj.transform.rotation.y),
            THREE.MathUtils.degToRad(sourceObj.transform.rotation.z)
        );

        const sNormal = new THREE.Vector3(source.normal.x, source.normal.y, source.normal.z).normalize();
        const tNormal = new THREE.Vector3(targetNormal.x, targetNormal.y, targetNormal.z).normalize();
        
        const targetSNormal = tNormal.clone().negate();
        const quaternion = new THREE.Quaternion().setFromUnitVectors(sNormal, targetSNormal);
        
        const currentQuat = sourceGroup.quaternion.clone();
        const newQuat = quaternion.clone().multiply(currentQuat);
        sourceGroup.quaternion.copy(newQuat);
        
        const sourceOrigin = sourceGroup.position.clone();
        const sPoint = new THREE.Vector3(source.point.x, source.point.y, source.point.z);
        const offset = sPoint.clone().sub(sourceOrigin);
        offset.applyQuaternion(quaternion);
        const newSourcePoint = sourceOrigin.clone().add(offset);
        
        const tPoint = new THREE.Vector3(targetPoint.x, targetPoint.y, targetPoint.z);
        const translation = tPoint.clone().sub(newSourcePoint);
        
        sourceGroup.position.add(translation);
        
        const euler = new THREE.Euler().setFromQuaternion(sourceGroup.quaternion);
        
        const newObjects = prev.objects.map(o => {
            if (o.id === source.objectId) {
                return {
                    ...o,
                    transform: {
                        ...o.transform,
                        position: { x: sourceGroup.position.x, y: sourceGroup.position.y, z: sourceGroup.position.z },
                        rotation: { 
                            x: THREE.MathUtils.radToDeg(euler.x), 
                            y: THREE.MathUtils.radToDeg(euler.y), 
                            z: THREE.MathUtils.radToDeg(euler.z) 
                        }
                    }
                };
            }
            return o;
        });

        return {
          ...prev,
          objects: newObjects,
          align: {
            enabled: false,
            step: 'select_source',
            source: undefined
          }
        };
      });
    }
  };

  const handleSnapCentroids = () => {
      if (state.selectedIds.length !== 2) return;
      const [id1, id2] = state.selectedIds;
      
      const obj1 = state.objects.find(o => o.id === id1);
      const obj2 = state.objects.find(o => o.id === id2);
      if (!obj1 || !obj2) return;

      pushHistory();

      const computeWorldBounds = (obj: SceneObject) => {
          const group = new THREE.Group();
          group.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
          group.rotation.set(
              THREE.MathUtils.degToRad(obj.transform.rotation.x),
              THREE.MathUtils.degToRad(obj.transform.rotation.y),
              THREE.MathUtils.degToRad(obj.transform.rotation.z)
          );
          group.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
          
          const mesh = new THREE.Mesh(obj.geometry);
          group.add(mesh);
          group.updateMatrixWorld(true);
          
          const box = new THREE.Box3().setFromObject(group);
          const center = new THREE.Vector3();
          box.getCenter(center);
          return { box, center, group };
      };

      const b1 = computeWorldBounds(obj1);
      const b2 = computeWorldBounds(obj2);

      const diff = b2.center.clone().sub(b1.center);
      const absDiff = [Math.abs(diff.x), Math.abs(diff.y), Math.abs(diff.z)];
      let dominantAxis = 0;
      if (absDiff[1] > absDiff[0] && absDiff[1] > absDiff[2]) dominantAxis = 1;
      if (absDiff[2] > absDiff[0] && absDiff[2] > absDiff[1]) dominantAxis = 2;

      const translation = new THREE.Vector3();
      const axes = ['x', 'y', 'z'] as const;

      for (let i = 0; i < 3; i++) {
          const axis = axes[i];
          if (i !== dominantAxis) {
              translation[axis] = b1.center[axis] - b2.center[axis];
          }
      }

      const domAxis = axes[dominantAxis];
      if (diff[domAxis] > 0) {
          translation[domAxis] = b1.box.max[domAxis] - b2.box.min[domAxis];
      } else {
          translation[domAxis] = b1.box.min[domAxis] - b2.box.max[domAxis];
      }

      setState(prev => {
          return {
              ...prev,
              objects: prev.objects.map(o => {
                  if (o.id === id2) {
                      return {
                          ...o,
                          transform: {
                              ...o.transform,
                              position: {
                                  x: o.transform.position.x + translation.x,
                                  y: o.transform.position.y + translation.y,
                                  z: o.transform.position.z + translation.z,
                              }
                          }
                      };
                  }
                  return o;
              })
          };
      });
  };

  
  const handleAlignToFloor = (id: string) => {
      const obj = state.objects.find(o => o.id === id);
      if (!obj) return;

      const group = new THREE.Group();
      group.position.set(obj.transform.position.x, obj.transform.position.y, obj.transform.position.z);
      group.rotation.set(
          THREE.MathUtils.degToRad(obj.transform.rotation.x),
          THREE.MathUtils.degToRad(obj.transform.rotation.y),
          THREE.MathUtils.degToRad(obj.transform.rotation.z)
      );
      group.scale.set(obj.transform.scale.x, obj.transform.scale.y, obj.transform.scale.z);
      
      const mesh = new THREE.Mesh(obj.geometry);
      group.add(mesh);
      group.updateMatrixWorld(true);
      
      const box = new THREE.Box3().setFromObject(group);
      const minZ = box.min.z;
      
      // if minZ is already 0, nothing to do
      if (Math.abs(minZ) < 0.001) return;
      
      pushHistory();
      handleUpdateObject(id, {
          transform: {
              ...obj.transform,
              position: {
                  ...obj.transform.position,
                  z: obj.transform.position.z - minZ
              }
          }
      });
  };

  const handleSelectObject = (id: string | null | 'all', multiSelect: boolean = false) => {
      setState(prev => {
          let newSelectedIds = [...(prev.selectedIds || [])];
          if (id === 'all') {
              newSelectedIds = prev.objects.map(o => o.id);
              return { ...prev, selectedId: 'all', selectedIds: newSelectedIds };
          }
          if (id === null) {
              return { ...prev, selectedId: null, selectedIds: [] };
          }
          if (multiSelect) {
              if (newSelectedIds.includes(id)) {
                  newSelectedIds = newSelectedIds.filter(i => i !== id);
              } else {
                  newSelectedIds.push(id);
              }
          } else {
              newSelectedIds = [id];
          }
          return { 
              ...prev, 
              selectedId: newSelectedIds.length > 0 ? newSelectedIds[newSelectedIds.length - 1] : null, 
              selectedIds: newSelectedIds,
              boolean: newSelectedIds.length === 2 ? prev.boolean : { ...prev.boolean, enabled: false }
          };
      });
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

      {/* Loading Overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm pointer-events-auto animate-in fade-in duration-200">
          <div className="flex flex-col items-center gap-4 text-white p-8 bg-slate-900 rounded-3xl shadow-2xl border border-slate-700/50 w-80">
            <Activity size={48} className="animate-pulse text-blue-500" />
            <div className="text-lg font-bold text-center w-full truncate">{loadingText || "Verarbeite..."}</div>
            
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden mt-2 relative border border-slate-700">
              {loadingProgress !== null ? (
                <div 
                  className="absolute top-0 bottom-0 left-0 bg-blue-500 transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(loadingProgress)}%` }}
                />
              ) : (
                <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-blue-500 rounded-full animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]" />
              )}
            </div>
            {loadingProgress !== null && (
              <div className="text-xs text-slate-400 font-mono mt-1 text-center">
                 {Math.round(loadingProgress)}%
              </div>
            )}
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
            onSelect={handleSelectObject}
            onUpdateObject={handleUpdateObject}
            onUpdateObjects={handleUpdateObjects}
            onDeleteObject={handleDelete}
            onDuplicateObject={handleDuplicate}
            onMirrorObject={handleMirrorObject}
            onApplyScale={handleApplyScale}
            onRepairObject={handleRepairObject}
               onScaleFromMeasure={handleScaleFromMeasure}
            onAddPrimitive={handleAddPrimitive}
            onEraseWithObject={handleEraseWithObject}
            onSliceChange={(slice) => setState(prev => ({ ...prev, slice }))}
            onBakeSlice={handleBakeSlice}
            onSplitChange={(split) => setState(prev => ({ ...prev, split }))}
            onPerformSplit={handlePerformSplit}
            onExtendChange={(extend) => setState(prev => ({ ...prev, extend }))}
            onPerformExtend={handlePerformExtend}
            onMergeObjects={handleMergeObjects}
            onExplodeView={handleExplodeView}
            onBooleanChange={(booleanState) => setState(prev => ({ ...prev, boolean: booleanState }))}
            onPerformBoolean={handlePerformBoolean}
            onViewModeChange={(mode) => setState(prev => ({ ...prev, viewMode: mode }))}
            onMeasureChange={(measure) => setState(prev => ({ ...prev, measure }))}
            onAnimationChange={(animation) => setState(prev => ({ ...prev, animation }))}
            onAlignChange={(align) => setState(prev => ({ ...prev, align }))}
            onTransformModeChange={(mode) => setState(prev => ({ ...prev, transformMode: mode }))}
            onSnapToEdgeChange={(snap) => setState(prev => ({ ...prev, snapToEdge: snap }))}
            onSnapCentroids={handleSnapCentroids}
            onGroupObjects={handleGroupObjects}
            onUngroupObjects={handleUngroupObjects}
            onExportCombined={handleExport}
            onExportAll={handleExportAll}
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

      
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
      
      <main className="flex-1 relative bg-slate-950">

        <div className="absolute top-6 left-6 z-20 flex gap-4">
            <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 px-5 py-2.5 rounded-2xl shadow-2xl transition-all hover:border-blue-500/50">
                <input type="file" accept=".stl,.stlc,.scad" multiple onChange={handleFileUpload} ref={fileInputRef} className="hidden" id="stl-upload" />
                <label htmlFor="stl-upload" className="flex items-center gap-2.5 text-sm font-bold cursor-pointer text-slate-300 hover:text-white transition-all group">
                    <Upload size={18} className="text-blue-500 group-hover:scale-110 transition-transform" />
                    Teile hinzufügen (STL, SCAD, STLC)
                </label>
            </div>
            
            <button 
                onClick={saveProject}
                className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 px-5 py-2.5 rounded-2xl shadow-2xl transition-all hover:border-green-500/50 text-sm font-bold text-slate-300 hover:text-white group"
            >
                <Download size={18} className="text-green-500 group-hover:scale-110 transition-transform" />
                Projekt speichern (.stlc)
            </button>

            
            <button 
                onClick={() => setIsHelpOpen(true)}
                className="flex items-center justify-center bg-slate-900/80 backdrop-blur-xl border border-slate-800/50 w-10 h-10 rounded-2xl shadow-2xl transition-all hover:border-slate-500/50 text-slate-300 hover:text-white"
                title="Hilfe & Tastaturkürzel"
            >
                <HelpCircle size={18} />
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

        <div className="w-full h-full relative">
           <Viewer 
               state={state} 
               onMeasureClick={handleMeasureClick} 
               onAlignClick={handleAlignClick} 
               onUpdateObject={handleUpdateObject} 
               onSaveHistory={pushHistory} 
               onClickObject={handleSelectObject} 
               onContextMenu={(id, x, y) => setContextMenu({ x, y, objectId: id })}
           />
           
           {contextMenu && (() => {
               const selectedObj = state.objects.find(o => o.id === contextMenu.objectId);
               if (!selectedObj) return null;
               const left = Math.min(contextMenu.x, window.innerWidth - 270);
               const top = Math.min(contextMenu.y, window.innerHeight - 360);
               return (
                 <div 
                   style={{ left, top }}
                   className="fixed z-50 bg-slate-900/95 backdrop-blur border border-slate-700/80 p-3 rounded-xl shadow-2xl w-64 text-slate-200 text-xs animate-in fade-in zoom-in-95 duration-100"
                   onClick={(e) => e.stopPropagation()}
                   onContextMenu={(e) => e.preventDefault()}
                 >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                       <span className="font-bold text-slate-300">Objekt-Eigenschaften</span>
                       <button onClick={() => setContextMenu(null)} className="text-slate-500 hover:text-slate-300">✕</button>
                    </div>
                    <div className="space-y-2">
                       <div>
                          <label className="block text-[10px] text-slate-400 font-semibold mb-0.5">Name</label>
                          <input 
                            type="text" 
                            value={selectedObj.name} 
                            onChange={(e) => handleUpdateObject(selectedObj.id, { name: e.target.value })}
                            className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-slate-100 focus:outline-none focus:border-blue-500"
                          />
                       </div>
                       
                       <div>
                          <div className="flex items-center justify-between mb-1">
                             <span className="block text-[10px] text-slate-400 font-semibold">Abmessungen (mm)</span>
                             <button 
                               onClick={() => setUniformScale(!uniformScale)}
                               className={`p-1 rounded transition-colors ${uniformScale ? 'text-blue-400 bg-blue-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                               title="Proportionen beibehalten"
                             >
                               {uniformScale ? <Lock size={10} /> : <Unlock size={10} />}
                             </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1">
                             <DimensionInput
                               label="Breite (X)"
                               value={parseFloat(((selectedObj.stats.boundingBox?.size?.x || 1) * Math.abs(selectedObj.transform.scale.x)).toFixed(2))}
                               onChange={(v) => {
                                  const sign = selectedObj.transform.scale.x < 0 ? -1 : 1;
                                  const newScaleX = sign * (v / (selectedObj.stats.boundingBox?.size?.x || 1));
                                  if (uniformScale) {
                                      const ratio = Math.abs(newScaleX / selectedObj.transform.scale.x);
                                      handleUpdateObject(selectedObj.id, {
                                          transform: {
                                              ...selectedObj.transform,
                                              scale: {
                                                  x: newScaleX,
                                                  y: selectedObj.transform.scale.y * ratio,
                                                  z: selectedObj.transform.scale.z * ratio
                                              }
                                          }
                                      });
                                  } else {
                                      handleUpdateObject(selectedObj.id, { 
                                         transform: { 
                                            ...selectedObj.transform, 
                                            scale: { ...selectedObj.transform.scale, x: newScaleX } 
                                         } 
                                      });
                                  }
                               }}
                             />
                             <DimensionInput
                               label="Höhe (Y)"
                               value={parseFloat(((selectedObj.stats.boundingBox?.size?.y || 1) * Math.abs(selectedObj.transform.scale.y)).toFixed(2))}
                               onChange={(v) => {
                                  const sign = selectedObj.transform.scale.y < 0 ? -1 : 1;
                                  const newScaleY = sign * (v / (selectedObj.stats.boundingBox?.size?.y || 1));
                                  if (uniformScale) {
                                      const ratio = Math.abs(newScaleY / selectedObj.transform.scale.y);
                                      handleUpdateObject(selectedObj.id, {
                                          transform: {
                                              ...selectedObj.transform,
                                              scale: {
                                                  x: selectedObj.transform.scale.x * ratio,
                                                  y: newScaleY,
                                                  z: selectedObj.transform.scale.z * ratio
                                              }
                                          }
                                      });
                                  } else {
                                      handleUpdateObject(selectedObj.id, { 
                                         transform: { 
                                            ...selectedObj.transform, 
                                            scale: { ...selectedObj.transform.scale, y: newScaleY } 
                                         } 
                                      });
                                  }
                               }}
                             />
                             <DimensionInput
                               label="Dicke (Z)"
                               value={parseFloat(((selectedObj.stats.boundingBox?.size?.z || 1) * Math.abs(selectedObj.transform.scale.z)).toFixed(2))}
                               onChange={(v) => {
                                  const sign = selectedObj.transform.scale.z < 0 ? -1 : 1;
                                  const newScaleZ = sign * (v / (selectedObj.stats.boundingBox?.size?.z || 1));
                                  if (uniformScale) {
                                      const ratio = Math.abs(newScaleZ / selectedObj.transform.scale.z);
                                      handleUpdateObject(selectedObj.id, {
                                          transform: {
                                              ...selectedObj.transform,
                                              scale: {
                                                  x: selectedObj.transform.scale.x * ratio,
                                                  y: selectedObj.transform.scale.y * ratio,
                                                  z: newScaleZ
                                              }
                                          }
                                      });
                                  } else {
                                      handleUpdateObject(selectedObj.id, { 
                                         transform: { 
                                            ...selectedObj.transform, 
                                            scale: { ...selectedObj.transform.scale, z: newScaleZ } 
                                         } 
                                      });
                                  }
                               }}
                             />
                          </div>
                       </div>

                       <div>
                          <span className="block text-[10px] text-slate-400 font-semibold mb-1">Position (mm)</span>
                          <div className="grid grid-cols-3 gap-1">
                             <div>
                                <span className="text-[8px] text-slate-500 block">X</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.position.x}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, x: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                             </div>
                             <div>
                                <span className="text-[8px] text-slate-500 block">Y</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.position.y}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, y: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                             </div>
                             <div>
                                <span className="text-[8px] text-slate-500 block">Z</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.position.z}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, position: { ...selectedObj.transform.position, z: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                             </div>
                          </div>
                       </div>

                       <div>
                          <span className="block text-[10px] text-slate-400 font-semibold mb-1">Rotation (°)</span>
                          <div className="grid grid-cols-3 gap-1">
                             <div>
                                <span className="text-[8px] text-slate-500 block">X</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.rotation.x}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, x: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 mb-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                                <div className="flex gap-1">
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, x: (selectedObj.transform.rotation.x + 90) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+90°</button>
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, x: (selectedObj.transform.rotation.x + 180) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+180°</button>
                                </div>
                             </div>
                             <div>
                                <span className="text-[8px] text-slate-500 block">Y</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.rotation.y}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, y: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 mb-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                                <div className="flex gap-1">
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, y: (selectedObj.transform.rotation.y + 90) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+90°</button>
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, y: (selectedObj.transform.rotation.y + 180) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+180°</button>
                                </div>
                             </div>
                             <div>
                                <span className="text-[8px] text-slate-500 block">Z</span>
                                <input 
                                  type="number" 
                                  step="1" 
                                  value={selectedObj.transform.rotation.z}
                                  onChange={(e) => {
                                     const v = parseFloat(e.target.value);
                                     if (!isNaN(v)) {
                                        handleUpdateObject(selectedObj.id, { 
                                           transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, z: v } } 
                                        });
                                     }
                                  }}
                                  className="w-full bg-slate-800 border border-slate-700 rounded p-1 mb-1 text-center font-mono focus:outline-none focus:border-blue-500"
                                />
                                <div className="flex gap-1">
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, z: (selectedObj.transform.rotation.z + 90) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+90°</button>
                                    <button onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, rotation: { ...selectedObj.transform.rotation, z: (selectedObj.transform.rotation.z + 180) % 360 } } })} className="flex-1 py-0.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-[8px] font-medium">+180°</button>
                                </div>
                             </div>
                          </div>
                       </div>
                       
                       <div className="mb-3">
                          <button
                             onClick={() => handleAlignToFloor(selectedObj.id)}
                             className="w-full py-2 bg-emerald-600/80 hover:bg-emerald-500 rounded-lg text-[10px] font-bold text-white transition-all flex items-center justify-center gap-2 border border-emerald-500/50"
                          >
                             Am Boden ausrichten (Z=0)
                          </button>
                       </div>
                       <div>
                          <span className="block text-[10px] text-slate-400 font-semibold mb-1">Spiegeln</span>

                          <div className="grid grid-cols-3 gap-1">
                             <button
                               onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, x: selectedObj.transform.scale.x * -1 } } })}
                               className={`px-1 py-1 rounded text-[10px] font-mono border transition-colors ${selectedObj.transform.scale.x < 0 ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                             >X Achse</button>
                             <button
                               onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, y: selectedObj.transform.scale.y * -1 } } })}
                               className={`px-1 py-1 rounded text-[10px] font-mono border transition-colors ${selectedObj.transform.scale.y < 0 ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                             >Y Achse</button>
                             <button
                               onClick={() => handleUpdateObject(selectedObj.id, { transform: { ...selectedObj.transform, scale: { ...selectedObj.transform.scale, z: selectedObj.transform.scale.z * -1 } } })}
                               className={`px-1 py-1 rounded text-[10px] font-mono border transition-colors ${selectedObj.transform.scale.z < 0 ? 'bg-blue-900/50 border-blue-500 text-blue-200' : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'}`}
                             >Z Achse</button>
                          </div>
                       </div>

                       <div>
                          <span className="block text-[10px] text-slate-400 font-semibold mb-1">Farbe</span>
                          <div className="flex gap-2 items-center">
                             <input 
                               type="color" 
                               value={selectedObj.color || '#ffffff'}
                               onChange={(e) => handleUpdateObject(selectedObj.id, { color: e.target.value })}
                               className="w-8 h-8 p-0 bg-transparent border-0 cursor-pointer rounded-sm overflow-hidden"
                             />
                             <div className="flex gap-1 flex-wrap flex-1">
                               {['#0ea5e9', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ffffff', '#94a3b8'].map(preset => (
                                 <button
                                   key={preset}
                                   type="button"
                                   onClick={() => handleUpdateObject(selectedObj.id, { color: preset })}
                                   className="w-4 h-4 rounded-sm border border-slate-700 hover:scale-110 transition-transform shadow-sm"
                                   style={{ backgroundColor: preset }}
                                   title={preset}
                                 />
                               ))}
                             </div>
                          </div>
                       </div>

                       <div className="pt-2 flex gap-1.5 justify-end">
                          <button 
                            type="button"
                            onClick={() => {
                               handleDelete(selectedObj.id);
                               setContextMenu(null);
                            }}
                            className="px-2 py-1 bg-red-950/40 hover:bg-red-900 border border-red-800/60 rounded text-red-200 text-[10px] transition-colors"
                          >
                            Löschen
                          </button>
                       </div>
                    </div>
                 </div>
               );
           })()}
           
           {state.measure?.enabled && state.measure.p1 && state.measure.p2 && (() => {
               const dist = Math.sqrt(
                 Math.pow(state.measure.p2.x - state.measure.p1.x, 2) +
                 Math.pow(state.measure.p2.y - state.measure.p1.y, 2) +
                 Math.pow(state.measure.p2.z - state.measure.p1.z, 2)
               );
               const displayDist = state.measure.unit === 'in' ? (dist / 25.4) : dist;
               return (
                 <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 bg-slate-900/90 backdrop-blur border border-cyan-500/50 px-6 py-3 rounded-2xl shadow-2xl flex flex-col items-center animate-in fade-in slide-in-from-top-4">
                    <span className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Distanz</span>
                    <span className="font-mono text-cyan-400 text-2xl font-bold">
                        {displayDist.toFixed(2)} {state.measure.unit === 'in' ? 'in' : 'mm'}
                    </span>
                 </div>
               );
            })()}

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
