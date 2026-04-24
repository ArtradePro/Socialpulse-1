import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { fabric } from 'fabric';
import {
    MousePointer2, Type, Square, Circle, Trash2,
    Undo2, Redo2, Download, Upload, Save, ArrowLeft, Image as ImageIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tool = 'select' | 'text' | 'rect' | 'circle';

interface TextProps {
    fontFamily: string;
    fontSize:   number;
    fill:       string;
    bold:       boolean;
    italic:     boolean;
}

interface ShapeProps {
    fill:        string;
    stroke:      string;
    strokeWidth: number;
}

interface ImageFilterProps {
    brightness: number;
    contrast:   number;
    saturation: number;
}

const FONTS = ['Arial', 'Georgia', 'Verdana', 'Courier New', 'Impact', 'Times New Roman'];
const CANVAS_W = 900;
const CANVAS_H = 600;
const MAX_HISTORY = 30;

// ─── Component ────────────────────────────────────────────────────────────────

export const ImageEditor: React.FC = () => {
    const navigate          = useNavigate();
    const [searchParams]    = useSearchParams();
    const canvasRef         = useRef<HTMLCanvasElement>(null);
    const fabricRef         = useRef<fabric.Canvas | null>(null);

    const [tool,       setTool]       = useState<Tool>('select');
    const [history,    setHistory]    = useState<string[]>([]);
    const [histIdx,    setHistIdx]    = useState(-1);
    const [saving,     setSaving]     = useState(false);
    const [bgColor,    setBgColor]    = useState('#ffffff');
    const [selType,    setSelType]    = useState<'none' | 'text' | 'shape' | 'image'>('none');

    const [textProps, setTextProps] = useState<TextProps>({
        fontFamily: 'Arial', fontSize: 28, fill: '#000000', bold: false, italic: false,
    });
    const [shapeProps, setShapeProps] = useState<ShapeProps>({
        fill: '#6366f1', stroke: '#4f46e5', strokeWidth: 2,
    });
    const [filterProps, setFilterProps] = useState<ImageFilterProps>({
        brightness: 0, contrast: 0, saturation: 0,
    });

    // ── History helpers ──────────────────────────────────────────────────────

    const pushHistory = useCallback((canvas: fabric.Canvas) => {
        const json = canvas.toJSON();
        const snap = JSON.stringify(json);
        setHistory(prev => {
            const trimmed = prev.slice(0, histIdx + 1);
            const next    = [...trimmed, snap].slice(-MAX_HISTORY);
            setHistIdx(next.length - 1);
            return next;
        });
    }, [histIdx]);

    const undo = useCallback(() => {
        if (histIdx <= 0 || !fabricRef.current) return;
        const prev = history[histIdx - 1];
        fabricRef.current.loadFromJSON(JSON.parse(prev), () => {
            fabricRef.current!.renderAll();
            setHistIdx(i => i - 1);
        });
    }, [history, histIdx]);

    const redo = useCallback(() => {
        if (histIdx >= history.length - 1 || !fabricRef.current) return;
        const next = history[histIdx + 1];
        fabricRef.current.loadFromJSON(JSON.parse(next), () => {
            fabricRef.current!.renderAll();
            setHistIdx(i => i + 1);
        });
    }, [history, histIdx]);

    // ── Canvas init ──────────────────────────────────────────────────────────

    useEffect(() => {
        if (!canvasRef.current) return;

        const canvas = new fabric.Canvas(canvasRef.current, {
            width:           CANVAS_W,
            height:          CANVAS_H,
            backgroundColor: '#ffffff',
            selection:       true,
        });
        fabricRef.current = canvas;

        canvas.on('object:added',    () => pushHistory(canvas));
        canvas.on('object:modified', () => pushHistory(canvas));
        canvas.on('object:removed',  () => pushHistory(canvas));

        canvas.on('selection:created', updateSelectionState);
        canvas.on('selection:updated', updateSelectionState);
        canvas.on('selection:cleared', () => setSelType('none'));

        // Keyboard: Delete selected, Ctrl+Z undo, Ctrl+Y redo
        const onKey = (e: KeyboardEvent) => {
            if ((e.target as HTMLElement).tagName === 'INPUT' ||
                (e.target as HTMLElement).tagName === 'TEXTAREA') return;
            if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
        };
        window.addEventListener('keydown', onKey);

        // Load src from query param if present
        const src = searchParams.get('src');
        if (src) loadImageUrl(canvas, src);

        // Initial history snapshot
        const snap = JSON.stringify(canvas.toJSON());
        setHistory([snap]);
        setHistIdx(0);

        return () => {
            window.removeEventListener('keydown', onKey);
            canvas.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Sync tool mode ───────────────────────────────────────────────────────

    useEffect(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        if (tool === 'select') {
            canvas.isDrawingMode = false;
            canvas.selection     = true;
            canvas.defaultCursor = 'default';
        } else {
            canvas.isDrawingMode = false;
            canvas.selection     = false;
            canvas.defaultCursor = 'crosshair';
        }
    }, [tool]);

    // ── Selection state sync ─────────────────────────────────────────────────

    function updateSelectionState() {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj) { setSelType('none'); return; }
        if (obj.type === 'i-text' || obj.type === 'text') {
            setSelType('text');
            const t = obj as fabric.IText;
            setTextProps({
                fontFamily: (t.fontFamily as string) || 'Arial',
                fontSize:   (t.fontSize as number)   || 28,
                fill:       (t.fill as string)        || '#000000',
                bold:       t.fontWeight === 'bold',
                italic:     t.fontStyle  === 'italic',
            });
        } else if (obj.type === 'image') {
            setSelType('image');
        } else {
            setSelType('shape');
            setShapeProps({
                fill:        (obj.fill   as string) || '#6366f1',
                stroke:      (obj.stroke as string) || '#4f46e5',
                strokeWidth: (obj.strokeWidth as number) || 2,
            });
        }
    }

    // ── Load image ───────────────────────────────────────────────────────────

    function loadImageUrl(canvas: fabric.Canvas, url: string) {
        fabric.Image.fromURL(url, (img) => {
            const scale = Math.min(CANVAS_W / (img.width! * 1.1), CANVAS_H / (img.height! * 1.1), 1);
            img.set({ left: CANVAS_W / 2, top: CANVAS_H / 2, originX: 'center', originY: 'center', scaleX: scale, scaleY: scale });
            canvas.add(img);
            canvas.renderAll();
        }, { crossOrigin: 'anonymous' });
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !fabricRef.current) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            if (!ev.target?.result) return;
            loadImageUrl(fabricRef.current!, ev.target.result as string);
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    };

    // ── Canvas click → add object ────────────────────────────────────────────

    const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = fabricRef.current;
        if (!canvas || tool === 'select') return;

        const rect   = canvasRef.current!.getBoundingClientRect();
        const left   = e.clientX - rect.left;
        const top    = e.clientY  - rect.top;

        if (tool === 'text') {
            const itext = new fabric.IText('Edit me', {
                left, top,
                fontFamily: textProps.fontFamily,
                fontSize:   textProps.fontSize,
                fill:       textProps.fill,
                fontWeight: textProps.bold   ? 'bold'   : 'normal',
                fontStyle:  textProps.italic ? 'italic' : 'normal',
            });
            canvas.add(itext);
            canvas.setActiveObject(itext);
            itext.enterEditing();
            setTool('select');
        } else if (tool === 'rect') {
            const r = new fabric.Rect({
                left, top, width: 120, height: 80,
                fill:        shapeProps.fill,
                stroke:      shapeProps.stroke,
                strokeWidth: shapeProps.strokeWidth,
            });
            canvas.add(r);
            canvas.setActiveObject(r);
            setTool('select');
        } else if (tool === 'circle') {
            const c = new fabric.Circle({
                left, top, radius: 50,
                fill:        shapeProps.fill,
                stroke:      shapeProps.stroke,
                strokeWidth: shapeProps.strokeWidth,
            });
            canvas.add(c);
            canvas.setActiveObject(c);
            setTool('select');
        }
        canvas.renderAll();
    }, [tool, textProps, shapeProps]);

    // ── Delete selected ──────────────────────────────────────────────────────

    const deleteSelected = useCallback(() => {
        const canvas = fabricRef.current;
        if (!canvas) return;
        const objs = canvas.getActiveObjects();
        objs.forEach(o => canvas.remove(o));
        canvas.discardActiveObject();
        canvas.renderAll();
    }, []);

    // ── Apply text properties ────────────────────────────────────────────────

    const applyTextProps = (patch: Partial<TextProps>) => {
        const next = { ...textProps, ...patch };
        setTextProps(next);
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getActiveObject() as fabric.IText;
        if (!obj || (obj.type !== 'i-text' && obj.type !== 'text')) return;
        obj.set({
            fontFamily: next.fontFamily,
            fontSize:   next.fontSize,
            fill:       next.fill,
            fontWeight: next.bold   ? 'bold'   : 'normal',
            fontStyle:  next.italic ? 'italic' : 'normal',
        });
        canvas.renderAll();
    };

    // ── Apply shape properties ────────────────────────────────────────────────

    const applyShapeProps = (patch: Partial<ShapeProps>) => {
        const next = { ...shapeProps, ...patch };
        setShapeProps(next);
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getActiveObject();
        if (!obj) return;
        obj.set({ fill: next.fill, stroke: next.stroke, strokeWidth: next.strokeWidth });
        canvas.renderAll();
    };

    // ── Apply image filters ───────────────────────────────────────────────────

    const applyFilters = (patch: Partial<ImageFilterProps>) => {
        const next = { ...filterProps, ...patch };
        setFilterProps(next);
        const canvas = fabricRef.current;
        if (!canvas) return;
        const obj = canvas.getActiveObject() as fabric.Image;
        if (!obj || obj.type !== 'image') return;

        obj.filters = [
            new fabric.Image.filters.Brightness({ brightness: next.brightness / 100 }),
            new fabric.Image.filters.Contrast({ contrast: next.contrast / 100 }),
            new fabric.Image.filters.Saturation({ saturation: next.saturation / 100 }),
        ];
        obj.applyFilters();
        canvas.renderAll();
    };

    // ── Background color ──────────────────────────────────────────────────────

    const applyBgColor = (color: string) => {
        setBgColor(color);
        if (!fabricRef.current) return;
        fabricRef.current.setBackgroundColor(color, () => fabricRef.current!.renderAll());
    };

    // ── Export ───────────────────────────────────────────────────────────────

    const exportPng = () => {
        if (!fabricRef.current) return;
        const url = fabricRef.current.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        const a = document.createElement('a');
        a.href = url;
        a.download = `image-editor-${Date.now()}.png`;
        a.click();
        toast.success('Image downloaded');
    };

    const saveToLibrary = async () => {
        if (!fabricRef.current) return;
        setSaving(true);
        try {
            const dataUrl = fabricRef.current.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
            const res     = await fetch(dataUrl);
            const blob    = await res.blob();
            const form    = new FormData();
            form.append('file', blob, `edited-${Date.now()}.png`);
            await api.post('/media/single', form, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('Saved to Media Library');
        } catch {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // ─── Render ───────────────────────────────────────────────────────────────

    const toolBtn = (t: Tool, Icon: React.FC<{ className?: string }>, label: string) => (
        <button
            key={t}
            onClick={() => setTool(t)}
            title={label}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                tool === t
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-gray-50">

            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 shrink-0">
                <button onClick={() => navigate(-1)}
                    className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <span className="text-gray-300 select-none">|</span>
                <h1 className="text-base font-semibold text-gray-900">Image Editor</h1>

                <div className="flex items-center gap-2 ml-auto">
                    <button onClick={undo} disabled={histIdx <= 0}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Undo (Ctrl+Z)">
                        <Undo2 className="w-4 h-4" />
                    </button>
                    <button onClick={redo} disabled={histIdx >= history.length - 1}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition-colors" title="Redo (Ctrl+Y)">
                        <Redo2 className="w-4 h-4" />
                    </button>
                    <button onClick={deleteSelected}
                        className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors" title="Delete selected (Del)">
                        <Trash2 className="w-4 h-4" />
                    </button>

                    <span className="text-gray-200 select-none">|</span>

                    <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl cursor-pointer transition-colors" title="Load image from file">
                        <Upload className="w-4 h-4" /> Load image
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                    </label>
                    <button onClick={exportPng}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                        <Download className="w-4 h-4" /> Export PNG
                    </button>
                    <button onClick={saveToLibrary} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-linear-to-r from-purple-600 to-blue-600 text-white rounded-xl hover:opacity-90 disabled:opacity-60 transition-opacity">
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving…' : 'Save to Library'}
                    </button>
                </div>
            </div>

            {/* ── Body ────────────────────────────────────────────────────── */}
            <div className="flex flex-1 min-h-0 overflow-hidden">

                {/* Left: Toolbox */}
                <div className="flex flex-col gap-1 p-3 bg-white border-r border-gray-200 w-[88px] shrink-0">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1 text-center">Tools</p>
                    {toolBtn('select', MousePointer2, 'Select')}
                    {toolBtn('text',   Type,          'Text')}
                    {toolBtn('rect',   Square,        'Rect')}
                    {toolBtn('circle', Circle,        'Circle')}

                    <div className="mt-auto">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1 text-center mt-4">BG</p>
                        <div className="flex justify-center">
                            <label className="relative w-10 h-10 rounded-xl border-2 border-gray-200 cursor-pointer overflow-hidden"
                                title="Canvas background color">
                                <span className="block w-full h-full" style={{ background: bgColor }} />
                                <input type="color" value={bgColor} onChange={e => applyBgColor(e.target.value)}
                                    className="absolute opacity-0 inset-0 cursor-pointer" />
                            </label>
                        </div>
                    </div>
                </div>

                {/* Center: Canvas */}
                <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-100 p-6">
                    {tool !== 'select' && (
                        <p className="absolute top-[80px] left-1/2 -translate-x-1/2 text-xs text-gray-400 bg-white px-3 py-1 rounded-full shadow pointer-events-none z-10">
                            Click on the canvas to place a {tool}
                        </p>
                    )}
                    <div className="shadow-2xl rounded-sm overflow-hidden">
                        <canvas ref={canvasRef} onClick={handleCanvasClick} />
                    </div>
                </div>

                {/* Right: Properties Panel */}
                <div className="w-64 shrink-0 bg-white border-l border-gray-200 overflow-y-auto">
                    <div className="p-4 space-y-4">

                        {selType === 'none' && (
                            <div className="text-center py-8">
                                <ImageIcon className="w-8 h-8 mx-auto text-gray-300 mb-2" />
                                <p className="text-xs text-gray-400">Select an object to edit its properties</p>
                            </div>
                        )}

                        {/* ── Text Properties ───────────────────── */}
                        {selType === 'text' && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Text</p>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Font family</label>
                                    <select value={textProps.fontFamily}
                                        onChange={e => applyTextProps({ fontFamily: e.target.value })}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400">
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Size — {textProps.fontSize}px</label>
                                    <input type="range" min={8} max={120} value={textProps.fontSize}
                                        onChange={e => applyTextProps({ fontSize: +e.target.value })}
                                        className="w-full accent-indigo-600" />
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Color</label>
                                    <div className="flex items-center gap-2">
                                        <label className="relative w-8 h-8 rounded-lg border border-gray-200 cursor-pointer overflow-hidden shrink-0">
                                            <span className="block w-full h-full" style={{ background: textProps.fill }} />
                                            <input type="color" value={textProps.fill}
                                                onChange={e => applyTextProps({ fill: e.target.value })}
                                                className="absolute opacity-0 inset-0" />
                                        </label>
                                        <input type="text" value={textProps.fill}
                                            onChange={e => applyTextProps({ fill: e.target.value })}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button onClick={() => applyTextProps({ bold: !textProps.bold })}
                                        className={`flex-1 py-1.5 text-sm font-bold rounded-lg border transition-colors ${
                                            textProps.bold ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}>B</button>
                                    <button onClick={() => applyTextProps({ italic: !textProps.italic })}
                                        className={`flex-1 py-1.5 text-sm italic rounded-lg border transition-colors ${
                                            textProps.italic ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                        }`}>I</button>
                                </div>
                            </div>
                        )}

                        {/* ── Shape Properties ──────────────────── */}
                        {selType === 'shape' && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Shape</p>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Fill</label>
                                    <div className="flex items-center gap-2">
                                        <label className="relative w-8 h-8 rounded-lg border border-gray-200 cursor-pointer overflow-hidden shrink-0">
                                            <span className="block w-full h-full" style={{ background: shapeProps.fill }} />
                                            <input type="color" value={shapeProps.fill}
                                                onChange={e => applyShapeProps({ fill: e.target.value })}
                                                className="absolute opacity-0 inset-0" />
                                        </label>
                                        <input type="text" value={shapeProps.fill}
                                            onChange={e => applyShapeProps({ fill: e.target.value })}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Stroke</label>
                                    <div className="flex items-center gap-2">
                                        <label className="relative w-8 h-8 rounded-lg border border-gray-200 cursor-pointer overflow-hidden shrink-0">
                                            <span className="block w-full h-full" style={{ background: shapeProps.stroke }} />
                                            <input type="color" value={shapeProps.stroke}
                                                onChange={e => applyShapeProps({ stroke: e.target.value })}
                                                className="absolute opacity-0 inset-0" />
                                        </label>
                                        <input type="text" value={shapeProps.stroke}
                                            onChange={e => applyShapeProps({ stroke: e.target.value })}
                                            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Stroke width — {shapeProps.strokeWidth}px</label>
                                    <input type="range" min={0} max={20} value={shapeProps.strokeWidth}
                                        onChange={e => applyShapeProps({ strokeWidth: +e.target.value })}
                                        className="w-full accent-indigo-600" />
                                </div>
                            </div>
                        )}

                        {/* ── Image Filters ─────────────────────── */}
                        {selType === 'image' && (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Image Filters</p>

                                {([
                                    { key: 'brightness', label: 'Brightness' },
                                    { key: 'contrast',   label: 'Contrast' },
                                    { key: 'saturation', label: 'Saturation' },
                                ] as const).map(({ key, label }) => (
                                    <div key={key}>
                                        <label className="text-xs text-gray-500 block mb-1">
                                            {label} — {filterProps[key] > 0 ? '+' : ''}{filterProps[key]}
                                        </label>
                                        <input type="range" min={-100} max={100} value={filterProps[key]}
                                            onChange={e => applyFilters({ [key]: +e.target.value } as Partial<ImageFilterProps>)}
                                            className="w-full accent-indigo-600" />
                                    </div>
                                ))}

                                <button
                                    onClick={() => applyFilters({ brightness: 0, contrast: 0, saturation: 0 })}
                                    className="w-full text-xs text-gray-500 hover:text-gray-800 py-1.5 border border-gray-200 rounded-lg transition-colors">
                                    Reset filters
                                </button>
                            </div>
                        )}

                        {/* ── Default text props when adding text ─ */}
                        {selType === 'none' && tool === 'text' && (
                            <div className="space-y-3 mt-0">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Text Defaults</p>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Font family</label>
                                    <select value={textProps.fontFamily}
                                        onChange={e => setTextProps(p => ({ ...p, fontFamily: e.target.value }))}
                                        className="w-full text-sm border border-gray-200 rounded-lg px-2 py-1.5">
                                        {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Size — {textProps.fontSize}px</label>
                                    <input type="range" min={8} max={120} value={textProps.fontSize}
                                        onChange={e => setTextProps(p => ({ ...p, fontSize: +e.target.value }))}
                                        className="w-full accent-indigo-600" />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Color</label>
                                    <label className="relative w-8 h-8 rounded-lg border border-gray-200 cursor-pointer overflow-hidden block">
                                        <span className="block w-full h-full" style={{ background: textProps.fill }} />
                                        <input type="color" value={textProps.fill}
                                            onChange={e => setTextProps(p => ({ ...p, fill: e.target.value }))}
                                            className="absolute opacity-0 inset-0" />
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ImageEditor;
