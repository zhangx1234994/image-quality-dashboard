import { useState, useRef, useCallback, useEffect } from "react";
import {
  Columns2,
  Layers,
  Diff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Upload,
  GripVertical,
  Info,
  BarChart2,
  Tag,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Check,
  AlertTriangle,
  X,
  ImageIcon,
  SlidersHorizontal,
  Eye,
} from "lucide-react";

type ViewMode = "sidebyside" | "slider" | "overlay" | "diff";

interface ImageMetrics {
  psnr: number;
  ssim: number;
  contrast: { original: number; result: number };
  brightness: { original: number; result: number };
  sharpness: { original: number; result: number };
  colorDeviation: number;
  noiseReduction: number;
  overallScore: number;
}

interface ImagePair {
  id: number;
  name: string;
  original: string;
  result: string;
  metrics: ImageMetrics;
  tag: string;
}

const SAMPLE_PAIRS: ImagePair[] = [
  {
    id: 1,
    name: "landscape_001.jpg",
    original:
      "https://images.unsplash.com/photo-1654738344031-441757e8818d?w=1080",
    result:
      "https://images.unsplash.com/photo-1718964313076-29a9f4edb971?w=1080",
    tag: "增强",
    metrics: {
      psnr: 34.7,
      ssim: 0.923,
      contrast: { original: 78, result: 89 },
      brightness: { original: 127, result: 134 },
      sharpness: { original: 62, result: 78 },
      colorDeviation: 4.2,
      noiseReduction: 72,
      overallScore: 88,
    },
  },
  {
    id: 2,
    name: "portrait_002.jpg",
    original:
      "https://images.unsplash.com/photo-1648333676834-d69d732d3528?w=1080",
    result:
      "https://images.unsplash.com/photo-1762657424841-7b5166d5d54c?w=1080",
    tag: "降噪",
    metrics: {
      psnr: 38.2,
      ssim: 0.961,
      contrast: { original: 71, result: 74 },
      brightness: { original: 142, result: 145 },
      sharpness: { original: 58, result: 69 },
      colorDeviation: 2.8,
      noiseReduction: 85,
      overallScore: 94,
    },
  },
  {
    id: 3,
    name: "arch_003.jpg",
    original:
      "https://images.unsplash.com/photo-1695067439031-f59068994fae?w=1080",
    result:
      "https://images.unsplash.com/photo-1618456289603-520b86372849?w=1080",
    tag: "超分",
    metrics: {
      psnr: 29.5,
      ssim: 0.876,
      contrast: { original: 84, result: 91 },
      brightness: { original: 118, result: 122 },
      sharpness: { original: 55, result: 88 },
      colorDeviation: 6.1,
      noiseReduction: 58,
      overallScore: 79,
    },
  },
];

function getScoreColor(score: number) {
  if (score >= 90) return "#22c55e";
  if (score >= 75) return "#3b82f6";
  if (score >= 60) return "#f59e0b";
  return "#ef4444";
}

function getScoreLabel(score: number) {
  if (score >= 90) return "优秀";
  if (score >= 75) return "良好";
  if (score >= 60) return "一般";
  return "较差";
}

function getPsnrColor(psnr: number) {
  if (psnr >= 40) return "#22c55e";
  if (psnr >= 30) return "#3b82f6";
  if (psnr >= 20) return "#f59e0b";
  return "#ef4444";
}

function getSsimColor(ssim: number) {
  if (ssim >= 0.95) return "#22c55e";
  if (ssim >= 0.85) return "#3b82f6";
  if (ssim >= 0.70) return "#f59e0b";
  return "#ef4444";
}

function DeltaIndicator({ original, result, unit = "" }: { original: number; result: number; unit?: string }) {
  const delta = result - original;
  const pct = Math.abs(Math.round((delta / original) * 100));
  if (delta > 0)
    return (
      <span className="flex items-center gap-0.5 text-emerald-400" style={{ fontSize: 11 }}>
        <ArrowUpRight size={11} />+{pct}%
      </span>
    );
  if (delta < 0)
    return (
      <span className="flex items-center gap-0.5 text-rose-400" style={{ fontSize: 11 }}>
        <ArrowDownRight size={11} />-{pct}%
      </span>
    );
  return (
    <span className="flex items-center gap-0.5 text-slate-500" style={{ fontSize: 11 }}>
      <Minus size={11} />持平
    </span>
  );
}

function MetricBar({ label, original, result, max = 100 }: { label: string; original: number; result: number; max?: number }) {
  const oPct = (original / max) * 100;
  const rPct = (result / max) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span style={{ color: "#94a3b8", fontSize: 12 }}>{label}</span>
        <DeltaIndicator original={original} result={result} />
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span style={{ color: "#64748b", fontSize: 10, width: 28, flexShrink: 0 }}>原图</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: "#1e2a3a" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${oPct}%`, background: "#475569" }}
            />
          </div>
          <span style={{ color: "#94a3b8", fontSize: 11, width: 24, textAlign: "right" }}>{original}</span>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ color: "#64748b", fontSize: 10, width: 28, flexShrink: 0 }}>结果</span>
          <div className="flex-1 h-2 rounded-full" style={{ background: "#1e2a3a" }}>
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${rPct}%`, background: "#3b82f6" }}
            />
          </div>
          <span style={{ color: "#60a5fa", fontSize: 11, width: 24, textAlign: "right" }}>{result}</span>
        </div>
      </div>
    </div>
  );
}

function SliderView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) updatePosition(e.clientX);
  }, [updatePosition]);

  const onMouseUp = useCallback(() => { isDragging.current = false; }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    if (isDragging.current && e.touches[0]) updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [onMouseMove, onMouseUp, onTouchMove]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden select-none"
      style={{ cursor: "col-resize" }}
      onClick={(e) => updatePosition(e.clientX)}
    >
      {/* Original (base layer) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={original}
          alt="原图"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%" }}
          draggable={false}
        />
      </div>

      {/* Result (clipped layer) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={result}
            alt="结果图"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%" }}
            draggable={false}
          />
        </div>
      </div>

      {/* Labels */}
      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8", backdropFilter: "blur(4px)" }}>
        原图
      </div>
      <div
        className="absolute top-3 z-10 px-2 py-0.5 rounded text-xs font-medium"
        style={{ left: `${sliderPos + 1}%`, background: "rgba(59,130,246,0.7)", color: "#fff", backdropFilter: "blur(4px)" }}
      >
        结果图
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 z-20 pointer-events-none"
        style={{ left: `${sliderPos}%`, transform: "translateX(-50%)", width: 2, background: "#fff" }}
      />

      {/* Drag Handle */}
      <div
        className="absolute top-1/2 z-30 flex items-center justify-center rounded-full shadow-2xl"
        style={{
          left: `${sliderPos}%`,
          transform: "translate(-50%, -50%)",
          width: 40,
          height: 40,
          background: "#fff",
          cursor: "col-resize",
          boxShadow: "0 0 0 3px rgba(59,130,246,0.4), 0 8px 24px rgba(0,0,0,0.6)",
        }}
        onMouseDown={(e) => { isDragging.current = true; e.preventDefault(); }}
        onTouchStart={(e) => { isDragging.current = true; e.preventDefault(); }}
      >
        <GripVertical size={16} color="#475569" />
      </div>

      {/* Position indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8", backdropFilter: "blur(4px)" }}>
        {Math.round(sliderPos)}% 结果 / {Math.round(100 - sliderPos)}% 原图
      </div>
    </div>
  );
}

function OverlayView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  const [opacity, setOpacity] = useState(100);
  const [showResult, setShowResult] = useState(true);

  return (
    <div className="relative w-full h-full flex flex-col">
      <div className="flex-1 relative overflow-hidden">
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={original}
            alt="原图"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%", position: "absolute" }}
            draggable={false}
          />
          {showResult && (
            <img
              src={result}
              alt="结果图"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center",
                transition: "transform 0.2s",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                width: "100%",
                height: "100%",
                position: "absolute",
                opacity: opacity / 100,
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Labels */}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8", backdropFilter: "blur(4px)" }}>
            原图
          </span>
          {showResult && (
            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(59,130,246,0.7)", color: "#fff", backdropFilter: "blur(4px)" }}>
              结果图 {opacity}%
            </span>
          )}
        </div>
      </div>

      {/* Overlay Controls */}
      <div
        className="flex-none flex items-center gap-4 px-6 py-3 border-t"
        style={{ background: "#101623", borderColor: "#1e2a3a" }}
      >
        <span style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>原图</span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="flex-1"
          style={{ accentColor: "#3b82f6" }}
        />
        <span style={{ color: "#3b82f6", fontSize: 12, whiteSpace: "nowrap" }}>结果图</span>
        <div className="w-px h-5" style={{ background: "#1e2a3a" }} />
        <button
          onClick={() => setShowResult(!showResult)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          style={{
            background: showResult ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)",
            color: showResult ? "#60a5fa" : "#64748b",
            border: `1px solid ${showResult ? "rgba(59,130,246,0.3)" : "#1e2a3a"}`,
          }}
        >
          <Eye size={12} />
          {showResult ? "隐藏结果图" : "显示结果图"}
        </button>
      </div>
    </div>
  );
}

function SideBySideView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  return (
    <div className="w-full h-full flex gap-0.5">
      <div className="relative flex-1 flex flex-col overflow-hidden" style={{ background: "#0a0f1a" }}>
        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8", backdropFilter: "blur(4px)" }}>
          原图
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <img
            src={original}
            alt="原图"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%" }}
            draggable={false}
          />
        </div>
      </div>

      <div className="w-0.5" style={{ background: "#1e2a3a", flexShrink: 0 }} />

      <div className="relative flex-1 flex flex-col overflow-hidden" style={{ background: "#0a0f1a" }}>
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(59,130,246,0.7)", color: "#fff", backdropFilter: "blur(4px)" }}>
          结果图
        </div>
        <div className="flex-1 flex items-center justify-center overflow-hidden">
          <img
            src={result}
            alt="结果图"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%" }}
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}

function DiffView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#000" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <img
          src={original}
          alt="原图"
          style={{ transform: `scale(${zoom})`, transformOrigin: "center", transition: "transform 0.2s", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%", position: "absolute" }}
          draggable={false}
        />
        <img
          src={result}
          alt="结果图"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.2s",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            width: "100%",
            height: "100%",
            position: "absolute",
            mixBlendMode: "difference",
          }}
          draggable={false}
        />
      </div>
      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8", backdropFilter: "blur(4px)" }}>
        差异图（亮 = 差异大）
      </div>
    </div>
  );
}

export function ImageComparisonDashboard() {
  const [viewMode, setViewMode] = useState<ViewMode>("slider");
  const [selectedPairId, setSelectedPairId] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [showMetrics, setShowMetrics] = useState(true);
  const [showList, setShowList] = useState(true);
  const [pairs, setPairs] = useState<ImagePair[]>(SAMPLE_PAIRS);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const resultInputRef = useRef<HTMLInputElement>(null);
  const pendingUploadType = useRef<"original" | "result">("original");
  const mainRef = useRef<HTMLDivElement>(null);

  // 从 API 获取真实数据
  useEffect(() => {
    fetch('/api/image-pairs?limit=50')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data && data.data.length > 0) {
          setPairs(data.data);
          setSelectedPairId(data.data[0].id);
        }
      })
      .catch(err => console.error('获取图片对比数据失败:', err));
  }, []);

  const selectedPair = pairs.find((p) => p.id === selectedPairId) || pairs[0];

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => Math.max(0.5, Math.min(4, z + (e.deltaY < 0 ? 0.1 : -0.1))));
  };

  const handleUpload = (type: "original" | "result") => {
    pendingUploadType.current = type;
    (type === "original" ? originalInputRef : resultInputRef).current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "original" | "result") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const name = file.name;
    setPairs((prev) => {
      const existing = prev.find((p) => p.id === selectedPairId);
      if (!existing) return prev;
      return prev.map((p) =>
        p.id === selectedPairId
          ? {
              ...p,
              name: type === "original" ? name : p.name,
              [type]: url,
            }
          : p
      );
    });
    e.target.value = "";
  };

  const modes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
    { id: "sidebyside", label: "并排", icon: <Columns2 size={14} /> },
    { id: "slider", label: "滑块", icon: <SlidersHorizontal size={14} /> },
    { id: "overlay", label: "叠加", icon: <Layers size={14} /> },
    { id: "diff", label: "差异", icon: <Diff size={14} /> },
  ];

  return (
    <div
      className="w-full h-full flex flex-col overflow-hidden"
      style={{ background: "#080d16", color: "#e2e8f0" }}
    >
      {/* ── Header ── */}
      <header
        className="flex-none flex items-center gap-4 px-4 border-b"
        style={{ height: 52, background: "#0d1422", borderColor: "#1a2332" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Columns2 size={14} color="#fff" />
          </div>
          <span style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>
            图看板
          </span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>
            QA
          </span>
        </div>

        {/* Pair name */}
        <div className="px-2 py-1 rounded text-xs" style={{ background: "#111d2e", color: "#64748b", border: "1px solid #1a2332" }}>
          <span style={{ color: "#94a3b8" }}>{selectedPair.name}</span>
        </div>

        <div className="flex-1" />

        {/* View mode switcher */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "#111d2e" }}>
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all"
              style={{
                background: viewMode === m.id ? "#3b82f6" : "transparent",
                color: viewMode === m.id ? "#fff" : "#64748b",
                fontWeight: viewMode === m.id ? 500 : 400,
              }}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="w-7 h-7 flex items-center justify-center rounded transition-all hover:opacity-80"
            style={{ background: "#111d2e", color: "#64748b" }}
          >
            <ZoomOut size={13} />
          </button>
          <span
            className="text-xs px-2 cursor-pointer"
            style={{ color: "#94a3b8", minWidth: 40, textAlign: "center" }}
            onClick={() => setZoom(1)}
            title="点击重置"
          >
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(4, z + 0.2))}
            className="w-7 h-7 flex items-center justify-center rounded transition-all hover:opacity-80"
            style={{ background: "#111d2e", color: "#64748b" }}
          >
            <ZoomIn size={13} />
          </button>
          <button
            onClick={() => setZoom(1)}
            className="w-7 h-7 flex items-center justify-center rounded transition-all hover:opacity-80"
            style={{ background: "#111d2e", color: "#64748b" }}
          >
            <Maximize2 size={13} />
          </button>
        </div>

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        {/* Upload buttons */}
        <button
          onClick={() => handleUpload("original")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all hover:opacity-80"
          style={{ background: "#111d2e", color: "#94a3b8", border: "1px solid #1a2332" }}
        >
          <Upload size={12} />
          原图
        </button>
        <button
          onClick={() => handleUpload("result")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all hover:opacity-80"
          style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}
        >
          <Upload size={12} />
          结果图
        </button>

        <input ref={originalInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "original")} />
        <input ref={resultInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileChange(e, "result")} />

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        {/* Panel toggles */}
        <button
          onClick={() => setShowMetrics(!showMetrics)}
          className="w-7 h-7 flex items-center justify-center rounded transition-all"
          style={{ background: showMetrics ? "rgba(59,130,246,0.15)" : "#111d2e", color: showMetrics ? "#60a5fa" : "#64748b" }}
          title="指标面板"
        >
          <BarChart2 size={13} />
        </button>
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex min-h-0">

        {/* ── Left: Thumbnail List ── */}
        <div
          className="flex-none flex flex-col border-r overflow-hidden transition-all duration-300"
          style={{ width: showList ? 200 : 0, background: "#0d1422", borderColor: "#1a2332" }}
        >
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#1a2332" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.05em" }}>
              IMAGE PAIRS
            </span>
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#111d2e", color: "#475569" }}>
              {pairs.length}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {pairs.map((pair) => {
              const isActive = pair.id === selectedPairId;
              return (
                <button
                  key={pair.id}
                  onClick={() => setSelectedPairId(pair.id)}
                  className="w-full rounded-lg overflow-hidden transition-all text-left"
                  style={{
                    background: isActive ? "#101d30" : "#111b2a",
                    border: `1px solid ${isActive ? "#3b82f6" : "#1a2332"}`,
                    outline: isActive ? "1px solid rgba(59,130,246,0.2)" : "none",
                  }}
                >
                  {/* Thumbnail preview */}
                  <div className="relative w-full" style={{ height: 70 }}>
                    <img src={pair.original} alt="" className="absolute inset-0 w-1/2 h-full object-cover" style={{ objectPosition: "center" }} />
                    <img src={pair.result} alt="" className="absolute inset-0 left-1/2 w-1/2 h-full object-cover" style={{ objectPosition: "center" }} />
                    <div className="absolute inset-0 left-1/2 w-px" style={{ background: "rgba(255,255,255,0.4)" }} />
                    <span
                      className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-xs"
                      style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8", fontSize: 10 }}
                    >
                      {pair.tag}
                    </span>
                    {isActive && (
                      <div className="absolute inset-0" style={{ background: "rgba(59,130,246,0.08)" }} />
                    )}
                  </div>

                  <div className="px-2 py-1.5">
                    <p style={{ fontSize: 11, color: isActive ? "#93c5fd" : "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pair.name}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: getScoreColor(pair.metrics.overallScore) }}
                      />
                      <span style={{ fontSize: 10, color: "#475569" }}>
                        评分 {pair.metrics.overallScore}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Center: Comparison View ── */}
        <div
          ref={mainRef}
          className="flex-1 min-w-0 relative overflow-hidden"
          style={{ background: "#080d16" }}
          onWheel={handleWheel}
        >
          {viewMode === "sidebyside" && (
            <SideBySideView original={selectedPair.original} result={selectedPair.result} zoom={zoom} />
          )}
          {viewMode === "slider" && (
            <SliderView original={selectedPair.original} result={selectedPair.result} zoom={zoom} />
          )}
          {viewMode === "overlay" && (
            <OverlayView original={selectedPair.original} result={selectedPair.result} zoom={zoom} />
          )}
          {viewMode === "diff" && (
            <DiffView original={selectedPair.original} result={selectedPair.result} zoom={zoom} />
          )}

          {/* List toggle button */}
          <button
            onClick={() => setShowList(!showList)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-10 flex items-center justify-center rounded-r transition-all hover:opacity-80"
            style={{ background: "#1a2332", color: "#64748b" }}
          >
            {showList ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        {/* ── Right: Metrics Panel ── */}
        <div
          className="flex-none flex flex-col border-l overflow-hidden transition-all duration-300"
          style={{ width: showMetrics ? 280 : 0, background: "#0d1422", borderColor: "#1a2332" }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "#1a2332" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.05em" }}>
              METRICS
            </span>
            <button onClick={() => setShowMetrics(false)} className="opacity-50 hover:opacity-100" style={{ color: "#64748b" }}>
              <X size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {/* Overall Score */}
            <div className="rounded-xl p-4 text-center" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
              <p style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>综合评分</p>
              <div
                className="text-5xl font-bold mb-1"
                style={{ color: getScoreColor(selectedPair.metrics.overallScore), lineHeight: 1 }}
              >
                {selectedPair.metrics.overallScore}
              </div>
              <div className="text-sm" style={{ color: getScoreColor(selectedPair.metrics.overallScore) }}>
                {getScoreLabel(selectedPair.metrics.overallScore)}
              </div>
              {/* Score bar */}
              <div className="mt-3 h-2 rounded-full overflow-hidden" style={{ background: "#1e2a3a" }}>
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${selectedPair.metrics.overallScore}%`,
                    background: `linear-gradient(90deg, ${getScoreColor(selectedPair.metrics.overallScore)}, ${getScoreColor(selectedPair.metrics.overallScore)}aa)`,
                  }}
                />
              </div>
            </div>

            {/* Key Metrics: PSNR + SSIM */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
                <p style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "0.05em" }}>PSNR</p>
                <p className="text-xl font-bold" style={{ color: getPsnrColor(selectedPair.metrics.psnr) }}>
                  {selectedPair.metrics.psnr.toFixed(1)}
                </p>
                <p style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>dB</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
                <p style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "0.05em" }}>SSIM</p>
                <p className="text-xl font-bold" style={{ color: getSsimColor(selectedPair.metrics.ssim) }}>
                  {selectedPair.metrics.ssim.toFixed(3)}
                </p>
                <p style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>相似度</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg p-3" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
                <p style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "0.05em" }}>色差 ΔE</p>
                <p className="text-xl font-bold" style={{ color: selectedPair.metrics.colorDeviation < 3 ? "#22c55e" : selectedPair.metrics.colorDeviation < 6 ? "#f59e0b" : "#ef4444" }}>
                  {selectedPair.metrics.colorDeviation.toFixed(1)}
                </p>
                <p style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>越小越好</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
                <p style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "0.05em" }}>降噪率</p>
                <p className="text-xl font-bold" style={{ color: "#3b82f6" }}>
                  {selectedPair.metrics.noiseReduction}%
                </p>
                <p style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>noise↓</p>
              </div>
            </div>

            {/* Separator */}
            <div className="h-px" style={{ background: "#1a2332" }} />

            {/* Detailed bars */}
            <div className="space-y-4">
              <MetricBar
                label="对比度"
                original={selectedPair.metrics.contrast.original}
                result={selectedPair.metrics.contrast.result}
              />
              <MetricBar
                label="亮度"
                original={selectedPair.metrics.brightness.original}
                result={selectedPair.metrics.brightness.result}
                max={255}
              />
              <MetricBar
                label="清晰度"
                original={selectedPair.metrics.sharpness.original}
                result={selectedPair.metrics.sharpness.result}
              />
            </div>

            {/* Separator */}
            <div className="h-px" style={{ background: "#1a2332" }} />

            {/* PSNR / SSIM reference */}
            <div className="rounded-lg p-3 space-y-2" style={{ background: "#0a1322", border: "1px solid #1a2332" }}>
              <p style={{ fontSize: 11, color: "#475569", fontWeight: 500, marginBottom: 6 }}>指标参考</p>
              {[
                { label: "PSNR ≥ 40dB", note: "优秀" },
                { label: "PSNR 30–40dB", note: "良好" },
                { label: "SSIM ≥ 0.95", note: "高保真" },
                { label: "ΔE < 3", note: "肉眼不可辨" },
              ].map((ref) => (
                <div key={ref.label} className="flex items-center justify-between">
                  <span style={{ fontSize: 10, color: "#475569" }}>{ref.label}</span>
                  <span style={{ fontSize: 10, color: "#334155" }}>{ref.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Status Bar ── */}
      <div
        className="flex-none flex items-center gap-4 px-4 border-t"
        style={{ height: 28, background: "#0a1020", borderColor: "#1a2332" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: 10, color: "#475569" }}>就绪</span>
        </div>
        <span style={{ fontSize: 10, color: "#334155" }}>|</span>
        <span style={{ fontSize: 10, color: "#475569" }}>模式：{modes.find((m) => m.id === viewMode)?.label}</span>
        <span style={{ fontSize: 10, color: "#334155" }}>|</span>
        <span style={{ fontSize: 10, color: "#475569" }}>缩放：{Math.round(zoom * 100)}%（滚轮缩放）</span>
        <div className="flex-1" />
        <span style={{ fontSize: 10, color: "#334155" }}>图看板 Image QA Dashboard v1.0</span>
      </div>
    </div>
  );
}
