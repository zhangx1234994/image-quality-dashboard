import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Diff,
  Eye,
  GripVertical,
  Layers,
  Maximize2,
  MessageSquare,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Tag,
  ThumbsUp,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
  Clock,
} from "lucide-react";
import { formatDateTime, formatDuration, formatSize, getErrorSummary, getSmallThumbnail, type ImagePair } from "../data/imagePairs";

type ViewMode = "sidebyside" | "slider" | "overlay" | "diff";
type QualityRating = "优秀" | "良好" | "一般" | "问题";

interface Annotation {
  rating: QualityRating | null;
  issues: string[];
  note: string;
  submitted: boolean;
}

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  画布扩展: { bg: "rgba(59,130,246,0.12)", text: "#60a5fa", border: "rgba(59,130,246,0.25)" },
  图片裂变: { bg: "rgba(168,85,247,0.12)", text: "#c084fc", border: "rgba(168,85,247,0.25)" },
  图案提取: { bg: "rgba(251,191,36,0.12)", text: "#fbbf24", border: "rgba(251,191,36,0.25)" },
  高清放大: { bg: "rgba(34,197,94,0.12)", text: "#4ade80", border: "rgba(34,197,94,0.25)" },
  局部编辑: { bg: "rgba(244,114,182,0.12)", text: "#f472b6", border: "rgba(244,114,182,0.25)" },
  无缝平铺: { bg: "rgba(56,189,248,0.12)", text: "#38bdf8", border: "rgba(56,189,248,0.25)" },
};

const STATUS_STYLE = {
  成功: { bg: "rgba(34,197,94,0.12)", color: "#4ade80", dot: "#22c55e" },
  失败: { bg: "rgba(239,68,68,0.12)", color: "#f87171", dot: "#ef4444" },
  处理中: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", dot: "#3b82f6" },
} as const;

const QUALITY_OPTIONS: Array<{ value: QualityRating; label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = [
  { value: "优秀", label: "优秀", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.3)", icon: <ThumbsUp size={13} /> },
  { value: "良好", label: "良好", color: "#3b82f6", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", icon: <CheckCircle2 size={13} /> },
  { value: "一般", label: "一般", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", icon: <Clock size={13} /> },
  { value: "问题", label: "问题", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", icon: <AlertTriangle size={13} /> },
];

const ISSUE_TAGS = [
  "结果与原图不匹配",
  "主体变形",
  "边缘模糊",
  "细节丢失",
  "构图偏移",
  "文字错误",
  "颜色异常",
  "背景异常",
  "伪影",
  "可用性差",
] as const;

function ImageCanvas({ src, alt, zoom, emptyText }: { src: string; alt: string; zoom: number; emptyText: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
            width: "100%",
            height: "100%",
          }}
          draggable={false}
        />
      ) : (
        <div className="flex items-center justify-center w-full h-full text-center px-8" style={{ color: "#475569", fontSize: 14 }}>
          {emptyText}
        </div>
      )}
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
    setSliderPos(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  useEffect(() => {
    const onMove = (event: MouseEvent) => { if (isDragging.current) updatePosition(event.clientX); };
    const onUp = () => { isDragging.current = false; };
    const onTouchMove = (event: TouchEvent) => {
      if (isDragging.current && event.touches[0]) {
        updatePosition(event.touches[0].clientX);
      }
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [updatePosition]);

  if (!result) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <ImageCanvas src={original} alt="原图" zoom={zoom} emptyText="无原图" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8" }}>
          暂无结果图，无法进行滑块对比
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none" style={{ cursor: "col-resize" }} onClick={(event) => updatePosition(event.clientX)}>
      <ImageCanvas src={original} alt="原图" zoom={zoom} emptyText="无原图" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}>
        <ImageCanvas src={result} alt="结果图" zoom={zoom} emptyText="无结果图" />
      </div>

      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8" }}>原图</div>
      <div className="absolute top-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ left: `${Math.min(sliderPos + 1, 80)}%`, background: "rgba(59,130,246,0.7)", color: "#fff" }}>结果图</div>
      <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: `${sliderPos}%`, transform: "translateX(-50%)", width: 2, background: "#fff" }} />
      <div
        className="absolute top-1/2 z-30 flex items-center justify-center rounded-full"
        style={{ left: `${sliderPos}%`, transform: "translate(-50%, -50%)", width: 40, height: 40, background: "#fff", cursor: "col-resize", boxShadow: "0 0 0 3px rgba(59,130,246,0.4), 0 8px 24px rgba(0,0,0,0.6)" }}
        onMouseDown={(event) => { isDragging.current = true; event.preventDefault(); }}
        onTouchStart={(event) => { isDragging.current = true; event.preventDefault(); }}
      >
        <GripVertical size={16} color="#475569" />
      </div>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8" }}>
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
        <ImageCanvas src={original} alt="原图" zoom={zoom} emptyText="无原图" />
        {result && showResult && (
          <div className="absolute inset-0">
            <img
              src={result}
              alt="结果图"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "center",
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
          </div>
        )}
        <div className="absolute top-3 left-3 z-10 flex gap-2">
          <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8" }}>原图</span>
          {result && showResult && <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(59,130,246,0.7)", color: "#fff" }}>结果图 {opacity}%</span>}
        </div>
        {!result && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-xs" style={{ background: "rgba(0,0,0,0.7)", color: "#94a3b8" }}>
            暂无结果图
          </div>
        )}
      </div>
      <div className="flex-none flex items-center gap-4 px-6 py-3 border-t" style={{ background: "#101623", borderColor: "#1e2a3a" }}>
        <span style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>原图</span>
        <input type="range" min={0} max={100} value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} className="flex-1" style={{ accentColor: "#3b82f6" }} disabled={!result} />
        <span style={{ color: "#3b82f6", fontSize: 12, whiteSpace: "nowrap" }}>结果图</span>
        <div className="w-px h-5" style={{ background: "#1e2a3a" }} />
        <button
          onClick={() => setShowResult(!showResult)}
          disabled={!result}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
          style={{ background: showResult ? "rgba(59,130,246,0.15)" : "rgba(255,255,255,0.05)", color: showResult ? "#60a5fa" : "#64748b", border: `1px solid ${showResult ? "rgba(59,130,246,0.3)" : "#1e2a3a"}`, opacity: result ? 1 : 0.5 }}
        >
          <Eye size={12} />{showResult ? "隐藏结果图" : "显示结果图"}
        </button>
      </div>
    </div>
  );
}

function SideBySideView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  return (
    <div className="w-full h-full flex gap-0.5 items-center justify-center">
      <div className="relative flex items-center justify-center overflow-hidden" style={{ background: "#0a0f1a", width: "45vw", height: "45vw", maxWidth: "600px", maxHeight: "600px" }}>
        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8" }}>原图</div>
        <ImageCanvas src={original} alt="原图" zoom={zoom} emptyText="无原图" />
      </div>
      <div className="w-0.5 h-full" style={{ background: "#1e2a3a", flexShrink: 0 }} />
      <div className="relative flex items-center justify-center overflow-hidden" style={{ background: "#0a0f1a", width: "45vw", height: "45vw", maxWidth: "600px", maxHeight: "600px" }}>
        <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(59,130,246,0.7)", color: "#fff" }}>结果图</div>
        <ImageCanvas src={result} alt="结果图" zoom={zoom} emptyText="无结果图" />
      </div>
    </div>
  );
}

function DiffView({ original, result, zoom }: { original: string; result: string; zoom: number }) {
  if (!result) {
    return (
      <div className="relative w-full h-full overflow-hidden" style={{ background: "#000" }}>
        <ImageCanvas src={original} alt="原图" zoom={zoom} emptyText="无原图" />
        <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8" }}>
          暂无结果图，无法生成差异图
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: "#000" }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <img src={original} alt="原图" style={{ transform: `scale(${zoom})`, maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%", position: "absolute" }} draggable={false} />
        <img src={result} alt="结果图" style={{ transform: `scale(${zoom})`, maxWidth: "100%", maxHeight: "100%", objectFit: "contain", width: "100%", height: "100%", position: "absolute", mixBlendMode: "difference" }} draggable={false} />
      </div>
      <div className="absolute top-3 left-3 z-10 px-2 py-0.5 rounded text-xs font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#94a3b8" }}>
        差异图（亮 = 差异大）
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-3">
      <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
      <span style={{ fontSize: 11, color: "#cbd5e1", textAlign: "right", wordBreak: "break-all" }}>{value || "—"}</span>
    </div>
  );
}

export function ComparePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([]);
  const [currentPair, setCurrentPair] = useState<ImagePair | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<number, Partial<ImagePair>>>({});
  const [annotations, setAnnotations] = useState<Record<number, Annotation>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("overlay");
  const [zoom, setZoom] = useState(1);
  const [showDetails, setShowDetails] = useState(true);
  const [showList, setShowList] = useState(true);
  const originalInputRef = useRef<HTMLInputElement>(null);
  const resultInputRef = useRef<HTMLInputElement>(null);

  const allPairs = imagePairs;
  const currentIndex = allPairs.findIndex((pair) => pair.id === Number(id));

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/image-pairs/${id}`, { signal: controller.signal }).then((res) => res.json()),
      fetch("/api/image-pairs?limit=200", { signal: controller.signal }).then((res) => res.json()),
    ])
      .then(([detailData, listData]) => {
        if (!detailData.success || !detailData.data) {
          setCurrentPair(null);
          setImagePairs([]);
          setError("未找到图片对");
          setLoading(false);
          return;
        }

        const detailPair = detailData.data as ImagePair;
        const listPairs = listData.success && Array.isArray(listData.data) ? listData.data : [];
        const mergedPairs = listPairs.some((pair: ImagePair) => pair.id === detailPair.id) ? listPairs : [detailPair, ...listPairs];

        setCurrentPair(detailPair);
        setImagePairs(mergedPairs);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("获取图片对比数据失败:", err);
        setCurrentPair(null);
        setImagePairs([]);
        setError("获取图片对比数据失败");
        setLoading(false);
      });

    return () => controller.abort();
  }, [id]);

  const getAnnotation = (pairId: number): Annotation => annotations[pairId] || { rating: null, issues: [], note: "", submitted: false };

  const updateAnnotation = (pairId: number, patch: Partial<Annotation>) => {
    setAnnotations((current) => ({
      ...current,
      [pairId]: { ...getAnnotation(pairId), ...patch, submitted: false },
    }));
  };

  const toggleIssue = (pairId: number, tag: string) => {
    const ann = getAnnotation(pairId);
    const issues = ann.issues.includes(tag) ? ann.issues.filter((item) => item !== tag) : [...ann.issues, tag];
    updateAnnotation(pairId, { issues });
  };

  const submitAnnotation = (pairId: number) => {
    setAnnotations((current) => ({
      ...current,
      [pairId]: { ...getAnnotation(pairId), submitted: true },
    }));
  };

  const resetAnnotation = (pairId: number) => {
    setAnnotations((current) => ({
      ...current,
      [pairId]: { rating: null, issues: [], note: "", submitted: false },
    }));
  };

  const pair: ImagePair | undefined = (() => {
    const base = currentIndex >= 0 ? allPairs[currentIndex] : currentPair;
    if (!base) return undefined;
    return { ...base, ...(overrides[base.id] || {}) };
  })();

  const goTo = (index: number) => {
    if (index >= 0 && index < allPairs.length) {
      navigate(`/compare/${allPairs[index].id}`);
    }
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    setZoom((current) => Math.max(0.5, Math.min(4, current + (event.deltaY < 0 ? 0.1 : -0.1))));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: "original" | "result") => {
    const file = event.target.files?.[0];
    if (!file || !pair) return;
    const url = URL.createObjectURL(file);
    setOverrides((current) => ({ ...current, [pair.id]: { ...current[pair.id], [type]: url } }));
    event.target.value = "";
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#080d16", color: "#94a3b8" }}>
        <p style={{ fontSize: 18 }}>加载中...</p>
      </div>
    );
  }

  if (!pair) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#080d16", color: "#94a3b8" }}>
        <div className="text-center space-y-4">
          <p style={{ fontSize: 18 }}>{error || "未找到图片对"}</p>
          <button onClick={() => navigate("/")} className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
            返回列表
          </button>
        </div>
      </div>
    );
  }

  const statusStyle = STATUS_STYLE[pair.status];
  const tagColor = TAG_COLORS[pair.operationType] || { bg: "rgba(100,116,139,0.12)", text: "#94a3b8", border: "rgba(100,116,139,0.25)" };
  const ann = getAnnotation(pair.id);
  const errorSummary = getErrorSummary(pair.errorMessage);

  const modes: Array<{ id: ViewMode; label: string; icon: React.ReactNode }> = [
    { id: "sidebyside", label: "并排", icon: <Columns2 size={14} /> },
    { id: "slider", label: "滑块", icon: <SlidersHorizontal size={14} /> },
    { id: "overlay", label: "叠加", icon: <Layers size={14} /> },
    { id: "diff", label: "差异", icon: <Diff size={14} /> },
  ];

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#080d16", color: "#e2e8f0" }}>
      <header className="flex-none flex items-center gap-3 px-4 border-b" style={{ height: 52, background: "#0d1422", borderColor: "#1a2332" }}>
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all" style={{ background: "#111d2e", color: "#94a3b8", border: "1px solid #1a2332" }}>
          <ArrowLeft size={12} /> 列表
        </button>

        <div className="flex items-center gap-1">
          <button onClick={() => goTo(currentIndex - 1)} disabled={currentIndex <= 0} className="w-7 h-7 flex items-center justify-center rounded transition-all disabled:opacity-20" style={{ background: "#111d2e", color: "#64748b" }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 11, color: "#475569", minWidth: 36, textAlign: "center" }}>
            {Math.max(currentIndex + 1, 1)}/{allPairs.length}
          </span>
          <button onClick={() => goTo(currentIndex + 1)} disabled={currentIndex >= allPairs.length - 1} className="w-7 h-7 flex items-center justify-center rounded transition-all disabled:opacity-20" style={{ background: "#111d2e", color: "#64748b" }}>
            <ChevronRight size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
            <Columns2 size={11} color="#fff" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>图看板</span>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <span className="px-2 py-0.5 rounded text-xs truncate" style={{ background: "#111d2e", color: "#94a3b8", border: "1px solid #1a2332", maxWidth: 240 }}>{pair.name}</span>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: tagColor.bg, color: tagColor.text, border: `1px solid ${tagColor.border}` }}>{pair.operationType}</span>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: statusStyle.bg, color: statusStyle.color }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
            {pair.status}
          </span>
          <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8" }}>{pair.model || "未知模型"}</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "#111d2e" }}>
          {modes.map((mode) => (
            <button key={mode.id} onClick={() => setViewMode(mode.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-all" style={{ background: viewMode === mode.id ? "#3b82f6" : "transparent", color: viewMode === mode.id ? "#fff" : "#64748b" }}>
              {mode.icon}{mode.label}
            </button>
          ))}
        </div>

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((current) => Math.max(0.5, current - 0.2))} className="w-7 h-7 flex items-center justify-center rounded" style={{ background: "#111d2e", color: "#64748b" }}><ZoomOut size={13} /></button>
          <span className="text-xs px-2 cursor-pointer" style={{ color: "#94a3b8", minWidth: 40, textAlign: "center" }} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((current) => Math.min(4, current + 0.2))} className="w-7 h-7 flex items-center justify-center rounded" style={{ background: "#111d2e", color: "#64748b" }}><ZoomIn size={13} /></button>
          <button onClick={() => setZoom(1)} className="w-7 h-7 flex items-center justify-center rounded" style={{ background: "#111d2e", color: "#64748b" }}><Maximize2 size={13} /></button>
        </div>

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        <button onClick={() => originalInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all" style={{ background: "#111d2e", color: "#94a3b8", border: "1px solid #1a2332" }}>
          <Upload size={12} />原图
        </button>
        <button onClick={() => resultInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all" style={{ background: "rgba(59,130,246,0.15)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.25)" }}>
          <Upload size={12} />结果图
        </button>
        <input ref={originalInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFileChange(event, "original")} />
        <input ref={resultInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => handleFileChange(event, "result")} />

        <div className="w-px h-6" style={{ background: "#1a2332" }} />

        <button onClick={() => setShowDetails(!showDetails)} className="w-7 h-7 flex items-center justify-center rounded transition-all" style={{ background: showDetails ? "rgba(59,130,246,0.15)" : "#111d2e", color: showDetails ? "#60a5fa" : "#64748b" }} title="信息面板">
          <Tag size={13} />
        </button>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-none flex flex-col border-r overflow-hidden transition-all duration-300" style={{ width: showList ? 208 : 0, background: "#0d1422", borderColor: "#1a2332" }}>
          <div className="flex items-center justify-between px-3 py-2 border-b" style={{ borderColor: "#1a2332" }}>
            <span style={{ fontSize: 11, color: "#64748b", fontWeight: 500, letterSpacing: "0.05em" }}>RECENT TASKS</span>
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: "#111d2e", color: "#475569" }}>{allPairs.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {allPairs.map((item) => {
              const active = item.id === pair.id;
              const itemStatus = STATUS_STYLE[item.status];
              return (
                <button key={item.id} onClick={() => navigate(`/compare/${item.id}`)} className="w-full rounded-lg overflow-hidden transition-all text-left" style={{ background: active ? "#101d30" : "#111b2a", border: `1px solid ${active ? "#3b82f6" : "#1a2332"}` }}>
                  <div className="relative w-full" style={{ height: 64 }}>
                    <div className="absolute inset-y-0 left-0 w-1/2" style={{ background: "#0a0f1a" }}>
                      {item.original ? <img src={getSmallThumbnail(item.original)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : null}
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-1/2" style={{ background: "#0a0f1a" }}>
                      {item.result ? <img src={getSmallThumbnail(item.result)} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center" style={{ color: "#475569", fontSize: 10 }}>无图</div>}
                    </div>
                    <div className="absolute inset-y-0 left-1/2 w-px" style={{ background: "rgba(255,255,255,0.4)" }} />
                    <span className="absolute top-1 left-1 px-1 py-0.5 rounded text-xs" style={{ background: itemStatus.bg, color: itemStatus.color, fontSize: 9 }}>{item.status}</span>
                  </div>
                  <div className="px-2 py-1.5 space-y-1">
                    <p style={{ fontSize: 10, color: active ? "#93c5fd" : "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtaskNo}</p>
                    <p style={{ fontSize: 10, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.model || item.operationType}</p>
                    <div className="flex items-center justify-between">
                      <span style={{ fontSize: 10, color: "#475569" }}>{formatDuration(item.durationSeconds)}</span>
                      <span style={{ fontSize: 10, color: "#475569" }}>{item.resultCount}/{item.originalCount}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-0 relative overflow-hidden" style={{ background: "#080d16" }} onWheel={handleWheel}>
          {viewMode === "sidebyside" && <SideBySideView original={pair.original} result={pair.result} zoom={zoom} />}
          {viewMode === "slider" && <SliderView original={pair.original} result={pair.result} zoom={zoom} />}
          {viewMode === "overlay" && <OverlayView original={pair.original} result={pair.result} zoom={zoom} />}
          {viewMode === "diff" && <DiffView original={pair.original} result={pair.result} zoom={zoom} />}

          <button onClick={() => setShowList(!showList)} className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-10 flex items-center justify-center rounded-r transition-all" style={{ background: "#1a2332", color: "#64748b" }}>
            {showList ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        </div>

        <div className="flex-none flex flex-col border-l overflow-hidden transition-all duration-300" style={{ width: showDetails ? 320 : 0, background: "#0d1422", borderColor: "#1a2332" }}>
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "#1a2332" }}>
            <div className="flex items-center gap-1.5">
              <Tag size={12} style={{ color: "#6366f1" }} />
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, letterSpacing: "0.05em" }}>任务信息与标注</span>
            </div>
            <button onClick={() => setShowDetails(false)} className="opacity-50 hover:opacity-100" style={{ color: "#64748b" }}><X size={13} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
            {ann.submitted && (
              <div className="rounded-xl p-3 flex items-center gap-2" style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)" }}>
                <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 12, color: "#4ade80", fontWeight: 600 }}>标注已提交</p>
                  <p style={{ fontSize: 11, color: "#64748b" }}>当前仅保存在本地页面状态</p>
                </div>
              </div>
            )}

            <div className="rounded-xl p-3 space-y-2" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
              <p style={{ fontSize: 11, color: "#475569", fontWeight: 500, marginBottom: 6 }}>任务概览</p>
              <InfoRow label="状态" value={pair.status} />
              <InfoRow label="操作类型" value={pair.operationType} />
              <InfoRow label="模型" value={pair.model || "—"} />
              <InfoRow label="主任务ID" value={pair.taskId} />
              <InfoRow label="子任务ID" value={pair.subtaskId} />
              <InfoRow label="Prompt ID" value={pair.promptId || "—"} />
              <InfoRow label="创建时间" value={formatDateTime(pair.createdAt)} />
              <InfoRow label="开始时间" value={formatDateTime(pair.startedAt)} />
              <InfoRow label="完成时间" value={formatDateTime(pair.finishedAt)} />
              <InfoRow label="处理耗时" value={formatDuration(pair.durationSeconds)} />
              <InfoRow label="输入/输出" value={`${pair.originalCount}/${pair.resultCount}`} />
              <InfoRow label="原图尺寸" value={formatSize(pair.originalWidth, pair.originalHeight)} />
            </div>

            <div className="rounded-xl p-3 space-y-2" style={{ background: "#111d2e", border: "1px solid #1a2332" }}>
              <p style={{ fontSize: 11, color: "#475569", fontWeight: 500, marginBottom: 6 }}>参数信息</p>
              <InfoRow label="请求尺寸" value={pair.requestedWidth && pair.requestedHeight ? `${pair.requestedWidth}×${pair.requestedHeight}` : "—"} />
              <InfoRow label="输出策略" value={pair.outputResolution || "—"} />
              <InfoRow label="工具类型" value={pair.toolType || "—"} />
              <InfoRow label="任务数量" value={pair.requestedCount !== null ? String(pair.requestedCount) : String(pair.subTaskCount)} />
              <InfoRow label="增强模式" value={pair.enhanced === null ? "—" : pair.enhanced ? "开启" : "关闭"} />
              <InfoRow label="创意强度" value={pair.creativeStrength !== null ? String(pair.creativeStrength) : "—"} />
              <InfoRow label="参考强度" value={pair.referenceStrength !== null ? String(pair.referenceStrength) : "—"} />
              <InfoRow label="辅助参考图" value={pair.auxImageCount ? `${pair.auxImageCount} 张` : "无"} />
              <InfoRow label="包含遮罩" value={pair.hasMask ? "是" : "否"} />
            </div>

            {pair.promptText && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <MessageSquare size={12} style={{ color: "#475569" }} />
                  <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, letterSpacing: "0.04em" }}>Prompt</p>
                </div>
                <div className="rounded-xl p-3 whitespace-pre-wrap break-words" style={{ background: "#111d2e", border: "1px solid #1a2332", color: "#cbd5e1", fontSize: 12, lineHeight: 1.6 }}>
                  {pair.promptText}
                </div>
              </div>
            )}

            {pair.errorMessage && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={12} style={{ color: "#ef4444" }} />
                  <p style={{ fontSize: 11, color: "#fca5a5", fontWeight: 500, letterSpacing: "0.04em" }}>错误信息</p>
                </div>
                <div className="rounded-xl p-3 space-y-2" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  <p style={{ fontSize: 12, color: "#f87171", fontWeight: 600 }}>{errorSummary}</p>
                  <div className="whitespace-pre-wrap break-words" style={{ color: "#cbd5e1", fontSize: 11, lineHeight: 1.6 }}>
                    {pair.errorMessage}
                  </div>
                </div>
              </div>
            )}

            <div className="h-px" style={{ background: "#1a2332" }} />

            <div>
              <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 10, letterSpacing: "0.04em" }}>
                人工质量判断 <span style={{ color: "#ef4444" }}>*</span>
              </p>
              <div className="grid grid-cols-2 gap-2">
                {QUALITY_OPTIONS.map((option) => {
                  const active = ann.rating === option.value;
                  return (
                    <button
                      key={option.value}
                      onClick={() => updateAnnotation(pair.id, { rating: option.value })}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all"
                      style={{ background: active ? option.bg : "rgba(255,255,255,0.03)", border: `1px solid ${active ? option.border : "#1a2332"}`, color: active ? option.color : "#475569" }}
                    >
                      <span style={{ color: active ? option.color : "#334155" }}>{option.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: active ? 600 : 400 }}>{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginBottom: 10, letterSpacing: "0.04em" }}>
                问题标签
                {ann.issues.length > 0 && <span className="ml-2 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8", fontSize: 10 }}>{ann.issues.length}</span>}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ISSUE_TAGS.map((tag) => {
                  const active = ann.issues.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleIssue(pair.id, tag)}
                      className="px-2.5 py-1 rounded-full text-xs transition-all"
                      style={{ background: active ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.04)", color: active ? "#f87171" : "#64748b", border: `1px solid ${active ? "rgba(239,68,68,0.35)" : "#1a2332"}` }}
                    >
                      {active && "✕ "}{tag}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <MessageSquare size={12} style={{ color: "#475569" }} />
                <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, letterSpacing: "0.04em" }}>备注说明</p>
              </div>
              <textarea
                value={ann.note}
                onChange={(event) => updateAnnotation(pair.id, { note: event.target.value })}
                placeholder="记录原图与结果图是否匹配，质量问题具体出现在哪里。"
                rows={4}
                className="w-full rounded-xl resize-none outline-none transition-all"
                style={{ background: "#111d2e", border: "1px solid #1a2332", color: "#cbd5e1", fontSize: 12, padding: "10px 12px", lineHeight: 1.6 }}
              />
            </div>

            <div className="flex gap-2 pb-2">
              <button onClick={() => resetAnnotation(pair.id)} className="flex items-center justify-center gap-1.5 rounded-xl py-2 px-3 text-xs transition-all" style={{ background: "#111d2e", color: "#64748b", border: "1px solid #1a2332", flexShrink: 0 }}>
                <RotateCcw size={12} /> 重置
              </button>
              <button
                onClick={() => ann.rating && submitAnnotation(pair.id)}
                disabled={!ann.rating}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium transition-all"
                style={{ background: ann.rating ? "linear-gradient(135deg,#6366f1,#a855f7)" : "#111d2e", color: ann.rating ? "#fff" : "#334155", cursor: ann.rating ? "pointer" : "not-allowed", opacity: ann.rating ? 1 : 0.5 }}
              >
                <Send size={13} />
                {ann.submitted ? "重新提交" : "提交标注"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none flex items-center gap-4 px-4 border-t" style={{ height: 28, background: "#0a1020", borderColor: "#1a2332" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: 10, color: "#475569" }}>就绪</span>
        </div>
        <span style={{ fontSize: 10, color: "#334155" }}>|</span>
        <span style={{ fontSize: 10, color: "#475569" }}>模式：{modes.find((mode) => mode.id === viewMode)?.label}</span>
        <span style={{ fontSize: 10, color: "#334155" }}>|</span>
        <span style={{ fontSize: 10, color: "#475569" }}>缩放：{Math.round(zoom * 100)}%</span>
        <div className="flex-1" />
        <span style={{ fontSize: 10, color: "#334155" }}>真实任务信息 + 人工质检</span>
      </div>
    </div>
  );
}
