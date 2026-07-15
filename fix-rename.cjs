const fs = require('fs');
let code = fs.readFileSync('components/Controls.tsx', 'utf-8');

code = code.replace(
    /const \[exportFormat, setExportFormat\] = useState\<'stl' \| 'obj' \| 'gltf'\>\('stl'\);/,
    "const [exportFormat, setExportFormat] = useState<'stl' | 'obj' | 'gltf'>('stl');\n  const [editingId, setEditingId] = useState<string | null>(null);\n  const [editingName, setEditingName] = useState(\"\");"
);

const newSpan = `
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
                        className={\`text-[11px] truncate cursor-text \${(state.selectedIds || []).includes(obj.id) ? 'text-blue-100 font-bold' : (!obj.visible ? 'text-slate-600 line-through' : 'text-slate-400')}\`}
                        title="Klicken zum Umbenennen"
                    >
                        {obj.name}
                    </span>
                )}
`;

code = code.replace(
    /<span className=\{`text-\[11px\] truncate \$\{\(state\.selectedIds \|\| \[\]\)\.includes\(obj\.id\) \? 'text-blue-100 font-bold' : \(!obj\.visible \? 'text-slate-600 line-through' : 'text-slate-400'\)\}`\}>\s*\{obj\.name\}\s*<\/span>/,
    newSpan
);

fs.writeFileSync('components/Controls.tsx', code);
console.log('Controls updated with rename functionality');
