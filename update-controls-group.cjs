const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

code = code.replace(
    /onSnapCentroids: \(\) => void;/,
    "onSnapCentroids: () => void;\n  onGroupObjects: () => void;"
);

const multiSelectBlock = `      {(state.selectedIds || []).length >= 2 && (
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
      )}`;

code = code.replace(
    /\{\(state\.selectedIds \|\| \[\]\)\.length === 2 && \(\s*<ControlGroup title="Zwei Objekte ausgewählt"[\s\S]*?<\/ControlGroup>\s*\)\}/,
    multiSelectBlock
);

fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls updated');
