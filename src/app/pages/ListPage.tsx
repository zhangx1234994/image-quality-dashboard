import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns2,
  LayoutGrid,
  List,
  Search,
  X,
} from "lucide-react";
import { formatDuration, formatSize, getErrorSummary, getListThumbnail, getSmallThumbnail, type ImagePair, type TaskStatus } from "../data/imagePairs";

type SortKey = "date" | "duration" | "status" | "action" | "model" | "name";
type SortDir = "asc" | "desc";
type ViewLayout = "grid" | "table";

interface FilterState {
  search: string;
  userId: string;
  operationType: string;
  status: string;
  dateStart: string;
  dateEnd: string;
}

interface ActionOption {
  value: string;
  label: string;
}

const DEFAULT_FILTERS: FilterState = {
  search: "",
  userId: "",
  operationType: "全部",
  status: "成功",
  dateStart: "",
  dateEnd: "",
};

const STATUS_STYLE: Record<TaskStatus, { bg: string; color: string; dot: string }> = {
  成功: { bg: "rgba(34,197,94,0.12)", color: "#4ade80", dot: "#22c55e" },
  失败: { bg: "rgba(239,68,68,0.12)", color: "#f87171", dot: "#ef4444" },
  处理中: { bg: "rgba(59,130,246,0.12)", color: "#60a5fa", dot: "#3b82f6" },
};

function getUserDisplay(pair: ImagePair) {
  return pair.nickname || pair.username || pair.userId || "未知用户";
}

function formatStrength(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  return `${value}`;
}

function getCreativeStrengthDisplay(pair: ImagePair) {
  return pair.referenceStrength ?? pair.creativeStrength;
}

function getStatusRank(status: TaskStatus) {
  if (status === "失败") return 3;
  if (status === "处理中") return 2;
  return 1;
}

function openCompare(id: number) {
  const url = `/compare/${id}`;
  const newWindow = window.open(url, "_blank");
  if (!newWindow || newWindow.closed || typeof newWindow.closed === "undefined") {
    window.location.href = url;
  }
}

function ThumbHalf({ src, alt, side }: { src: string; alt: string; side: "left" | "right" }) {
  return (
    <div className="relative w-1/2" style={{ aspectRatio: "1 / 1", background: "#0a0f1a" }}>
      {src ? (
        <img
          src={getListThumbnail(src)}
          alt={alt}
          className="absolute inset-0 w-full h-full object-contain"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-3 text-center" style={{ color: "#475569", fontSize: 11 }}>
          {side === "left" ? "无原图" : "无结果图"}
        </div>
      )}
    </div>
  );
}

function MiniThumb({ src, side }: { src: string; side: "left" | "right" }) {
  return src ? (
    <img
      src={getSmallThumbnail(src)}
      alt=""
      className={`absolute inset-y-0 ${side === "left" ? "left-0" : "left-1/2"} w-1/2 h-full object-cover`}
      loading="lazy"
    />
  ) : (
    <div
      className={`absolute inset-y-0 ${side === "left" ? "left-0" : "left-1/2"} w-1/2 h-full flex items-center justify-center`}
      style={{ background: "#0a0f1a", color: "#475569", fontSize: 10 }}
    >
      无图
    </div>
  );
}

function GridCard({ pair, onClick }: { pair: ImagePair; onClick: () => void }) {
  const statusStyle = STATUS_STYLE[pair.status];
  const errorSummary = getErrorSummary(pair.errorMessage);
  const userDisplay = getUserDisplay(pair);
  const metricItems = [
    { label: "耗时", value: formatDuration(pair.durationSeconds) },
    { label: "原图尺寸", value: formatSize(pair.originalWidth, pair.originalHeight) },
    ...(pair.operationType === "图片裂变" ? [{ label: "创意强度", value: formatStrength(getCreativeStrengthDisplay(pair)) }] : []),
  ];

  return (
    <button
      onClick={onClick}
      className="group rounded-xl overflow-hidden text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{ background: "#0d1422", border: "1px solid #1a2332", boxShadow: "0 2px 8px rgba(0,0,0,0.3)" }}
    >
      <div className="relative overflow-hidden flex">
        <ThumbHalf src={pair.original} alt="原图" side="left" />
        <ThumbHalf src={pair.result} alt="结果图" side="right" />
        <div className="absolute inset-y-0 left-1/2 w-0.5" style={{ background: "rgba(255,255,255,0.5)", transform: "translateX(-50%)" }} />
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(0,0,0,0.65)", color: "#94a3b8" }}>原</div>
        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(59,130,246,0.72)", color: "#fff" }}>结</div>
        <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
          <span style={{ fontSize: 10, fontWeight: 600 }}>{pair.status}</span>
        </div>
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center" style={{ background: "rgba(8,13,22,0.38)" }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: "rgba(99,102,241,0.92)", color: "#fff" }}>
            <Columns2 size={13} />
            <span style={{ fontSize: 12, fontWeight: 500 }}>{pair.result ? "查看对比" : "查看详情"}</span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p style={{ fontSize: 12, color: "#94a3b8" }}>{pair.subtaskNo}</p>
            <p style={{ fontSize: 13, color: "#e2e8f0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pair.operationType}</p>
          </div>
          <span className="px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", fontSize: 10 }}>
            {pair.model || "未知模型"}
          </span>
        </div>

        {pair.promptText && (
          <p style={{ fontSize: 11, color: "#64748b", lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {pair.promptText}
          </p>
        )}

        {errorSummary && (
          <div className="rounded-lg px-2 py-1.5" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.16)", color: "#f87171", fontSize: 11 }}>
            {errorSummary}
          </div>
        )}

        <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${metricItems.length}, minmax(0, 1fr))` }}>
          {metricItems.map((item) => (
            <div key={item.label} className="rounded-lg px-2 py-1.5" style={{ background: "#111d2e" }}>
              <p style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>{item.label}</p>
              <p style={{ fontSize: 12, color: "#cbd5e1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.value}</p>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <span style={{ fontSize: 11, color: "#334155" }}>{pair.date}</span>
          <span style={{ fontSize: 11, color: "#475569", maxWidth: 112, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userDisplay}</span>
        </div>
      </div>
    </button>
  );
}

function TableRow({ pair, onClick, index }: { pair: ImagePair; onClick: () => void; index: number }) {
  const statusStyle = STATUS_STYLE[pair.status];
  const userDisplay = getUserDisplay(pair);

  return (
    <tr
      onClick={onClick}
      className="group cursor-pointer transition-all"
      style={{ background: index % 2 === 0 ? "#0d1422" : "#0a1020" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#101d30"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = index % 2 === 0 ? "#0d1422" : "#0a1020"; }}
    >
      <td className="px-4 py-3">
        <div className="relative rounded-md overflow-hidden" style={{ width: 72, height: 48 }}>
          <MiniThumb src={pair.original} side="left" />
          <MiniThumb src={pair.result} side="right" />
          <div className="absolute inset-y-0 left-1/2 w-0.5" style={{ background: "rgba(255,255,255,0.4)", transform: "translateX(-50%)" }} />
        </div>
      </td>
      <td className="px-3 py-3">
        <span style={{ fontSize: 12, color: "#94a3b8" }}>{pair.subtaskNo}</span>
        <p style={{ fontSize: 11, color: "#475569", marginTop: 1 }}>{pair.taskId}</p>
      </td>
      <td className="px-3 py-3">
        <span style={{ fontSize: 12, color: "#cbd5e1" }}>{pair.operationType}</span>
      </td>
      <td className="px-3 py-3">
        <span style={{ fontSize: 11, color: "#94a3b8" }}>{pair.model || "未知"}</span>
      </td>
      <td className="px-3 py-3">
        <span className="flex items-center gap-1 w-fit px-2 py-0.5 rounded-full" style={{ background: statusStyle.bg, color: statusStyle.color, fontSize: 11 }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusStyle.dot }} />
          {pair.status}
        </span>
      </td>
      <td className="px-3 py-3"><span style={{ fontSize: 12, color: "#cbd5e1" }}>{formatDuration(pair.durationSeconds)}</span></td>
      <td className="px-3 py-3"><span style={{ fontSize: 12, color: "#94a3b8" }}>{formatSize(pair.originalWidth, pair.originalHeight)}</span></td>
      <td className="px-3 py-3">
        <div className="min-w-0">
          <div style={{ fontSize: 12, color: "#cbd5e1", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{userDisplay}</div>
          <div style={{ fontSize: 10, color: "#64748b", fontFamily: "monospace", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pair.userId}</div>
        </div>
      </td>
      <td className="px-3 py-3"><span style={{ fontSize: 11, color: "#475569" }}>{pair.date}</span></td>
      <td className="px-4 py-3">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1" style={{ color: "#6366f1", fontSize: 12 }}>
          查看 <ArrowRight size={12} />
        </div>
      </td>
    </tr>
  );
}

export function ListPage() {
  const [layout, setLayout] = useState<ViewLayout>("grid");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterOpen, setFilterOpen] = useState(true);
  const [columns, setColumns] = useState(4);
  const [actionOptions, setActionOptions] = useState<ActionOption[]>([]);
  const [imagePairs, setImagePairs] = useState<ImagePair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 50;

  useEffect(() => {
    fetch("/api/actions")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setActionOptions(data.data);
        }
      })
      .catch((err) => {
        console.error("获取操作类型失败:", err);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      limit: pageSize.toString(),
      offset: ((page - 1) * pageSize).toString(),
    });

    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.userId.trim()) params.set("user_id", filters.userId.trim());
    if (filters.operationType !== "全部") params.set("action", filters.operationType);
    if (filters.status !== "全部") params.set("status", filters.status);
    if (filters.dateStart) params.set("start_date", filters.dateStart);
    if (filters.dateEnd) params.set("end_date", filters.dateEnd);

    fetch(`/api/image-pairs?${params.toString()}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.data)) {
          setImagePairs(data.data);
          setTotal(data.count || 0);
        } else {
          setError("获取数据失败");
        }
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("获取图片对比数据失败:", err);
        setError("网络错误");
        setLoading(false);
      });

    return () => controller.abort();
  }, [filters, page]);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const resetFilters = () => {
    setPage(1);
    setFilters(DEFAULT_FILTERS);
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.userId) count++;
    if (filters.operationType !== "全部") count++;
    if (filters.status !== "全部") count++;
    if (filters.dateStart) count++;
    if (filters.dateEnd) count++;
    return count;
  }, [filters]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("desc");
  };

  const filteredSorted = useMemo(() => {
    return [...imagePairs].sort((a, b) => {
      let left: number | string = "";
      let right: number | string = "";

      switch (sortKey) {
        case "name":
          left = a.name;
          right = b.name;
          break;
        case "duration":
          left = a.durationSeconds ?? -1;
          right = b.durationSeconds ?? -1;
          break;
        case "status":
          left = getStatusRank(a.status);
          right = getStatusRank(b.status);
          break;
        case "action":
          left = a.operationType;
          right = b.operationType;
          break;
        case "model":
          left = a.model;
          right = b.model;
          break;
        case "date":
        default:
          left = new Date(a.createdAt).getTime();
          right = new Date(b.createdAt).getTime();
          break;
      }

      if (left < right) return sortDir === "asc" ? -1 : 1;
      if (left > right) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [imagePairs, sortDir, sortKey]);

  const stats = useMemo(() => {
    const uniqueUsers = new Set(imagePairs.map((pair) => pair.userId).filter(Boolean));
    return {
      total,
      success: filters.status === "成功" ? total : imagePairs.filter((pair) => pair.status === "成功").length,
      failed: filters.status === "失败" ? total : imagePairs.filter((pair) => pair.status === "失败").length,
      users: uniqueUsers.size,
    };
  }, [filters.status, imagePairs, total]);

  const actionLabelMap = useMemo(
    () => new Map(actionOptions.map((option) => [option.value, option.label])),
    [actionOptions],
  );

  const selectedActionLabel =
    filters.operationType === "全部"
      ? "全部"
      : (actionLabelMap.get(filters.operationType) || filters.operationType);

  const sortLabelMap: Record<SortKey, string> = {
    date: "日期",
    duration: "耗时",
    status: "状态",
    action: "操作类型",
    model: "模型",
    name: "文件名",
  };

  const SortIcon = ({ sort }: { sort: SortKey }) =>
    sortKey === sort ? (
      sortDir === "asc" ? <ChevronUp size={12} style={{ color: "#6366f1" }} /> : <ChevronDown size={12} style={{ color: "#6366f1" }} />
    ) : (
      <ArrowUpDown size={11} style={{ color: "#334155" }} />
    );

  const inputStyle: CSSProperties = {
    width: "100%",
    background: "#111d2e",
    border: "1px solid #1a2332",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
    padding: "6px 10px",
    outline: "none",
  };

  const labelStyle: CSSProperties = {
    fontSize: 11,
    color: "#64748b",
    fontWeight: 500,
    letterSpacing: "0.04em",
    display: "block",
    marginBottom: 5,
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden" style={{ background: "#080d16", color: "#e2e8f0" }}>
      <header className="flex-none flex items-center gap-4 px-6 border-b" style={{ height: 56, background: "#0d1422", borderColor: "#1a2332" }}>
        <div className="flex items-center gap-2 mr-2">
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}>
            <Columns2 size={14} color="#fff" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>图看板</span>
          <span className="ml-1 px-1.5 py-0.5 rounded text-xs" style={{ background: "rgba(99,102,241,0.2)", color: "#818cf8" }}>真实任务视图</span>
        </div>

        <div className="w-px h-5" style={{ background: "#1a2332" }} />

        <div className="flex items-center gap-5">
          {[
            { label: "总数", value: stats.total },
            { label: "成功", value: stats.success, color: "#22c55e" },
            { label: "失败", value: stats.failed, color: "#ef4444" },
            { label: "用户", value: stats.users, color: "#3b82f6" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span style={{ fontSize: 11, color: "#475569" }}>{item.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: item.color || "#94a3b8" }}>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="flex-1" />

        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#475569" }} />
          <input
            type="text"
            placeholder="搜索任务号 / 子任务 / Prompt…"
            value={filters.search}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: "#111d2e", border: "1px solid #1a2332", color: "#e2e8f0", width: 240 }}
          />
          {filters.search && (
            <button onClick={() => updateFilter("search", "")} className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: "#475569" }}>
              <X size={12} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: "#111d2e" }}>
          <button onClick={() => setLayout("grid")} className="w-7 h-7 flex items-center justify-center rounded-md transition-all" style={{ background: layout === "grid" ? "#6366f1" : "transparent", color: layout === "grid" ? "#fff" : "#64748b" }}>
            <LayoutGrid size={13} />
          </button>
          <button onClick={() => setLayout("table")} className="w-7 h-7 flex items-center justify-center rounded-md transition-all" style={{ background: layout === "table" ? "#6366f1" : "transparent", color: layout === "table" ? "#fff" : "#64748b" }}>
            <List size={13} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-none flex flex-col border-r transition-all duration-300" style={{ width: filterOpen ? 220 : 40, background: "#0d1422", borderColor: "#1a2332" }}>
          <div className="flex-none flex items-center justify-center py-3 border-b" style={{ borderColor: "#1a2332", height: 48 }}>
            <button
              onClick={() => setFilterOpen(!filterOpen)}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
              style={{
                background: filterOpen ? "rgba(99,102,241,0.15)" : "#111d2e",
                color: filterOpen ? "#818cf8" : "#94a3b8",
                border: `1px solid ${filterOpen ? "rgba(99,102,241,0.3)" : "#1a2332"}`,
              }}
            >
              {filterOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ opacity: filterOpen ? 1 : 0, transition: "opacity 0.3s", display: filterOpen ? "block" : "none" }}>
            <div className="p-4 space-y-5">
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500, letterSpacing: "0.05em" }}>筛选条件</span>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters} className="flex items-center gap-1 text-xs" style={{ color: "#818cf8" }}>
                    <X size={10} /> 清空
                  </button>
                )}
              </div>

              <div>
                <label style={labelStyle}>用户ID / 用户名</label>
                <input type="text" placeholder="输入用户ID、用户名…" value={filters.userId} onChange={(e) => updateFilter("userId", e.target.value)} style={inputStyle} />
              </div>

              <div className="h-px" style={{ background: "#1a2332" }} />

              <div>
                <label style={labelStyle}>操作类型</label>
                <select value={filters.operationType} onChange={(e) => updateFilter("operationType", e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                  <option value="全部">全部</option>
                  {actionOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="h-px" style={{ background: "#1a2332" }} />

              <div>
                <label style={labelStyle}>状态</label>
                <div className="flex flex-col gap-1.5">
                  {(["全部", "成功", "失败", "处理中"] as const).map((status) => {
                    const active = filters.status === status;
                    const statusStyle = status !== "全部" ? STATUS_STYLE[status as TaskStatus] : null;
                    return (
                      <button
                        key={status}
                        onClick={() => updateFilter("status", status)}
                        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all"
                        style={{
                          background: active ? "rgba(99,102,241,0.1)" : "transparent",
                          color: active ? "#818cf8" : "#64748b",
                          border: `1px solid ${active ? "rgba(99,102,241,0.3)" : "transparent"}`,
                        }}
                      >
                        {statusStyle && <span className="w-2 h-2 rounded-full" style={{ background: statusStyle.dot }} />}
                        <span style={{ fontSize: 12 }}>{status}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px" style={{ background: "#1a2332" }} />

              <div>
                <label style={labelStyle}>开始日期</label>
                <input type="date" value={filters.dateStart} onChange={(e) => updateFilter("dateStart", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>

              <div>
                <label style={labelStyle}>结束日期</label>
                <input type="date" value={filters.dateEnd} onChange={(e) => updateFilter("dateEnd", e.target.value)} style={{ ...inputStyle, colorScheme: "dark" }} />
              </div>

              <div className="h-px" style={{ background: "#1a2332" }} />

              <div>
                <label style={labelStyle}>每行显示</label>
                <div className="grid grid-cols-4 gap-1">
                  {[2, 3, 4, 5].map((col) => (
                    <button
                      key={col}
                      onClick={() => setColumns(col)}
                      className="px-2 py-1.5 rounded-lg text-center transition-all"
                      style={{
                        background: columns === col ? "rgba(99,102,241,0.1)" : "transparent",
                        color: columns === col ? "#818cf8" : "#64748b",
                        border: `1px solid ${columns === col ? "rgba(99,102,241,0.3)" : "transparent"}`,
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{col}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px" style={{ background: "#1a2332" }} />

              <div>
                <label style={labelStyle}>排序方式</label>
                <div className="space-y-1">
                  {[
                    { key: "date" as SortKey, label: "日期" },
                    { key: "duration" as SortKey, label: "耗时" },
                    { key: "status" as SortKey, label: "状态" },
                    { key: "action" as SortKey, label: "操作类型" },
                    { key: "model" as SortKey, label: "模型" },
                    { key: "name" as SortKey, label: "文件名" },
                  ].map((item) => (
                    <button
                      key={item.key}
                      onClick={() => toggleSort(item.key)}
                      className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all text-left"
                      style={{
                        background: sortKey === item.key ? "rgba(99,102,241,0.1)" : "transparent",
                        color: sortKey === item.key ? "#818cf8" : "#64748b",
                      }}
                    >
                      <span style={{ fontSize: 12 }}>{item.label}</span>
                      {sortKey === item.key && (sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-none flex items-center gap-3 px-5 py-2.5 border-b" style={{ background: "#0a1020", borderColor: "#1a2332" }}>
            <span style={{ fontSize: 12, color: "#64748b" }}>
              当前页 <span style={{ color: "#94a3b8", fontWeight: 600 }}>{filteredSorted.length}</span> 条
              <span style={{ color: "#475569" }}> / 共 {total} 条</span>
            </span>

            {filters.search && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                搜索: {filters.search}
                <button onClick={() => updateFilter("search", "")}><X size={9} /></button>
              </span>
            )}
            {filters.userId && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                用户: {filters.userId.length > 10 ? `${filters.userId.slice(0, 10)}…` : filters.userId}
                <button onClick={() => updateFilter("userId", "")}><X size={9} /></button>
              </span>
            )}
            {filters.operationType !== "全部" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                {selectedActionLabel}
                <button onClick={() => updateFilter("operationType", "全部")}><X size={9} /></button>
              </span>
            )}
            {filters.status !== "全部" && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs" style={{ background: "rgba(99,102,241,0.1)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.2)" }}>
                {filters.status}
                <button onClick={() => updateFilter("status", "全部")}><X size={9} /></button>
              </span>
            )}

            <div className="flex-1" />
            <span style={{ fontSize: 11, color: "#334155" }}>
              按 {sortLabelMap[sortKey]} {sortDir === "desc" ? "↓" : "↑"} 排序
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#475569" }}>
                <p style={{ fontSize: 15 }}>加载中...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#334155" }}>
                <AlertCircle size={40} style={{ color: "#1e2a3a" }} />
                <p style={{ fontSize: 15, color: "#94a3b8" }}>{error}</p>
              </div>
            ) : filteredSorted.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: "#334155" }}>
                <AlertCircle size={40} style={{ color: "#1e2a3a" }} />
                <p style={{ fontSize: 15, color: "#475569" }}>没有符合筛选条件的结果</p>
                <button onClick={resetFilters} className="px-4 py-2 rounded-lg text-sm" style={{ background: "rgba(99,102,241,0.15)", color: "#818cf8", border: "1px solid rgba(99,102,241,0.25)" }}>
                  清空筛选
                </button>
              </div>
            ) : layout === "grid" ? (
              <div className="p-5 grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                {filteredSorted.map((pair) => (
                  <GridCard key={pair.id} pair={pair} onClick={() => openCompare(pair.id)} />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse" style={{ minWidth: 1080 }}>
                  <thead>
                    <tr style={{ background: "#0a1020", borderBottom: "1px solid #1a2332" }}>
                      <th className="px-4 py-3 text-left" style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>预览</th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("name")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "name" ? "#818cf8" : "#475569", fontWeight: 500 }}>子任务 <SortIcon sort="name" /></div></th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("action")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "action" ? "#818cf8" : "#475569", fontWeight: 500 }}>操作类型 <SortIcon sort="action" /></div></th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("model")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "model" ? "#818cf8" : "#475569", fontWeight: 500 }}>模型 <SortIcon sort="model" /></div></th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("status")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "status" ? "#818cf8" : "#475569", fontWeight: 500 }}>状态 <SortIcon sort="status" /></div></th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("duration")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "duration" ? "#818cf8" : "#475569", fontWeight: 500 }}>耗时 <SortIcon sort="duration" /></div></th>
                      <th className="px-3 py-3 text-left" style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>原图尺寸</th>
                      <th className="px-3 py-3 text-left" style={{ fontSize: 11, color: "#475569", fontWeight: 500 }}>用户</th>
                      <th className="px-3 py-3 text-left cursor-pointer" onClick={() => toggleSort("date")}><div className="flex items-center gap-1.5" style={{ fontSize: 11, color: sortKey === "date" ? "#818cf8" : "#475569", fontWeight: 500 }}>日期 <SortIcon sort="date" /></div></th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSorted.map((pair, index) => (
                      <TableRow key={pair.id} pair={pair} index={index} onClick={() => openCompare(pair.id)} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && total > 0 && (
              <div className="flex items-center justify-center py-4 gap-3">
                <button
                  onClick={() => page > 1 && setPage(page - 1)}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded text-xs transition-all"
                  style={{ background: page <= 1 ? "#1a2332" : "#6366f1", color: page <= 1 ? "#475569" : "#fff", cursor: page <= 1 ? "not-allowed" : "pointer" }}
                >
                  上一页
                </button>

                {(() => {
                  const totalPages = Math.ceil(total / pageSize);
                  const pages: Array<number | string> = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else if (page <= 3) {
                    pages.push(1, 2, 3, 4, "...", totalPages);
                  } else if (page >= totalPages - 2) {
                    pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                  } else {
                    pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
                  }

                  return pages.map((item, index) => (
                    typeof item === "string" ? (
                      <span key={`ellipsis-${index}`} className="text-xs" style={{ color: "#64748b" }}>...</span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => item !== page && setPage(item)}
                        className="w-7 h-7 rounded text-xs transition-all"
                        style={{ background: item === page ? "#6366f1" : "transparent", color: item === page ? "#fff" : "#94a3b8", border: item === page ? "none" : "1px solid #1a2332" }}
                      >
                        {item}
                      </button>
                    )
                  ));
                })()}

                <button
                  onClick={() => page < Math.ceil(total / pageSize) && setPage(page + 1)}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-1.5 rounded text-xs transition-all"
                  style={{ background: page >= Math.ceil(total / pageSize) ? "#1a2332" : "#6366f1", color: page >= Math.ceil(total / pageSize) ? "#475569" : "#fff", cursor: page >= Math.ceil(total / pageSize) ? "not-allowed" : "pointer" }}
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-none flex items-center gap-4 px-5 border-t" style={{ height: 28, background: "#0a1020", borderColor: "#1a2332" }}>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e" }} />
          <span style={{ fontSize: 10, color: "#475569" }}>就绪</span>
        </div>
        <span style={{ fontSize: 10, color: "#334155" }}>|</span>
        <span style={{ fontSize: 10, color: "#475569" }}>真实数据库字段，无伪质量指标</span>
        <div className="flex-1" />
        <span style={{ fontSize: 10, color: "#334155" }}>图看板 Image QA Dashboard v1.1</span>
      </div>
    </div>
  );
}
