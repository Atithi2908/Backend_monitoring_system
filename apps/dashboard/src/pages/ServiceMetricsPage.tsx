import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getCurrentUser, isAuthenticated, logout } from '../services/auth';
import {
  getRequestMetrics,
  getSystemMetrics,
  RequestMetricPoint,
  SystemMetricPoint,
} from '../services/project';

type TabType = 'system' | 'request';
type TimeWindow = 'minutes' | 'hours' | 'day';

type UnitType = 'ms' | 'percent' | 'requests' | 'mb';

type TimeSeriesPoint = {
  ts: number;
  value: number | null;
  secondaryValue?: number | null;
};

const TIME_WINDOW_CONFIG: Record<TimeWindow, { label: string; windowMs: number; subtitle: string }> = {
  minutes: { label: 'Minutes', windowMs: 60 * 60 * 1000, subtitle: 'Last 60 minutes' },
  hours: { label: 'Hours', windowMs: 48 * 60 * 60 * 1000, subtitle: 'Last 48 hours' },
  day: { label: 'Day', windowMs: 30 * 24 * 60 * 60 * 1000, subtitle: 'Last 30 days' },
};

type EndpointAggregate = {
  key: string;
  method: string;
  route: string;
  totalRequests: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  avgResponseTime: number;
  maxResponseTime: number;
  p95ResponseTime: number;
};

const CHART_WIDTH = 820;
const CHART_HEIGHT = 280;
const CHART_PADDING_TOP = 16;
const CHART_PADDING_RIGHT = 16;
const CHART_PADDING_BOTTOM = 40;
const CHART_PADDING_LEFT = 64;

function getBucketIntervalMs(timeWindow: TimeWindow): number {
  if (timeWindow === 'minutes') {
    return 60 * 1000;
  }

  if (timeWindow === 'hours') {
    return 60 * 60 * 1000;
  }

  return 24 * 60 * 60 * 1000;
}

function buildExpectedBuckets(from: number, to: number, bucketMs: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to) || bucketMs <= 0 || from > to) {
    return [];
  }

  const start = Math.floor(from / bucketMs) * bucketMs;
  const end = Math.floor(to / bucketMs) * bucketMs;
  const buckets: number[] = [];

  for (let ts = start; ts <= end; ts += bucketMs) {
    buckets.push(ts);
  }

  return buckets;
}

function toNumberBucket(value: string | number | undefined): number {
  return typeof value === 'string' ? Number(value) : value ?? 0;
}

function formatBucketLabel(ts: number, timeWindow: TimeWindow): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return '-';
  }

  if (timeWindow === 'minutes') {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (timeWindow === 'hours') {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit' });
  }

  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatXAxisTick(ts: number, timeWindow: TimeWindow): string {
  if (!Number.isFinite(ts) || ts <= 0) {
    return '-';
  }

  if (timeWindow === 'minutes') {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  if (timeWindow === 'hours') {
    return new Date(ts).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', hour12: false });
  }

  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatValue(value: number, unit: UnitType, precise = false): string {
  if (unit === 'ms') {
    if (precise) {
      return `${value.toFixed(2)} ms`;
    }
    return value >= 100 ? `${Math.round(value)} ms` : `${value.toFixed(1)} ms`;
  }

  if (unit === 'percent') {
    return `${(precise ? value.toFixed(2) : value.toFixed(1))}%`;
  }

  if (unit === 'mb') {
    if (precise) {
      return `${value.toFixed(2)} MB`;
    }
    return value >= 100 ? `${Math.round(value)} MB` : `${value.toFixed(1)} MB`;
  }

  return precise ? `${value.toFixed(2)}` : `${Math.round(value).toLocaleString()}`;
}

function getTickIntervalMs(timeWindow: TimeWindow, from: number, to: number): number {
  const range = Math.max(to - from, 1);

  const candidates =
    timeWindow === 'minutes'
      ? [60 * 1000, 2 * 60 * 1000, 5 * 60 * 1000, 10 * 60 * 1000, 15 * 60 * 1000]
      : timeWindow === 'hours'
        ? [60 * 60 * 1000, 2 * 60 * 60 * 1000, 3 * 60 * 60 * 1000, 6 * 60 * 60 * 1000, 12 * 60 * 60 * 1000]
        : [24 * 60 * 60 * 1000, 2 * 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000, 5 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];

  const maxTicks = 8;
  for (const candidate of candidates) {
    if (range / candidate <= maxTicks) {
      return candidate;
    }
  }

  return candidates[candidates.length - 1];
}

function buildXAxisTicks(timeWindow: TimeWindow, from: number, to: number): number[] {
  const tickMs = getTickIntervalMs(timeWindow, from, to);
  const start = Math.ceil(from / tickMs) * tickMs;
  const ticks: number[] = [];

  for (let ts = start; ts <= to; ts += tickMs) {
    ticks.push(ts);
  }

  if (ticks.length === 0) {
    ticks.push(from, to);
  }

  return ticks;
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(rawStep));
  const fraction = rawStep / 10 ** exponent;

  if (fraction <= 1) return 1 * 10 ** exponent;
  if (fraction <= 2) return 2 * 10 ** exponent;
  if (fraction <= 5) return 5 * 10 ** exponent;
  return 10 * 10 ** exponent;
}

function buildNiceYAxis(
  values: number[],
  mode: 'auto' | 'percent' | 'uptime',
  unit: UnitType
): { min: number; max: number; ticks: number[] } {
  if (mode === 'percent') {
    return { min: 0, max: 100, ticks: [0, 20, 40, 60, 80, 100] };
  }

  if (mode === 'uptime') {
    const observedMin = values.length ? Math.min(...values) : 99;
    const min = observedMin < 95 ? Math.floor(observedMin) : 95;
    const max = 100;
    const step = observedMin < 95 ? 1 : 0.5;
    const ticks: number[] = [];
    for (let tick = min; tick <= max + 1e-9; tick += step) {
      ticks.push(Number(tick.toFixed(2)));
    }
    return { min, max, ticks };
  }

  if (!values.length) {
    return { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] };
  }

  let rawMin = Math.min(...values);
  let rawMax = Math.max(...values);

  if (rawMin === rawMax) {
    const delta = rawMax === 0 ? 1 : Math.abs(rawMax) * 0.2;
    rawMin -= delta;
    rawMax += delta;
  }

  const range = rawMax - rawMin;
  const paddedMax = rawMax + range * 0.12;
  const paddedMin = unit === 'requests' ? 0 : rawMin - range * 0.05;

  const targetTicks = 6;
  const step = niceStep((paddedMax - paddedMin) / (targetTicks - 1));
  const min = Math.floor(paddedMin / step) * step;
  const max = Math.ceil(paddedMax / step) * step;

  const ticks: number[] = [];
  for (let tick = min; tick <= max + 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return { min, max, ticks };
}

const VolumeTimeChart: React.FC<{
  title: string;
  yLabel: string;
  unit: UnitType;
  points: TimeSeriesPoint[];
  timeWindow: TimeWindow;
  from: number;
  to: number;
  tone?: 'primary' | 'ink';
  yMode?: 'auto' | 'percent' | 'uptime';
  showSecondaryLine?: boolean;
  secondaryLabel?: string;
  thresholdLine?: { value: number; label: string };
  tooltipTotalLabel?: string;
}> = ({
  title,
  yLabel,
  unit,
  points,
  timeWindow,
  from,
  to,
  tone = 'primary',
  yMode = 'auto',
  showSecondaryLine = false,
  secondaryLabel = 'Secondary',
  thresholdLine,
  tooltipTotalLabel,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const clampZoom = (value: number) => {
    return Math.max(1, Math.min(8, value));
  };

  useEffect(() => {
    setZoomLevel(1);
    setHoveredIndex(null);
  }, [from, to, timeWindow]);

  const visibleSpan = Math.max((to - from) / clampZoom(zoomLevel), 1);
  const visibleFrom = to - visibleSpan;
  const visibleTo = to;
  const xRange = Math.max(visibleTo - visibleFrom, 1);
  const plotWidth = CHART_WIDTH - CHART_PADDING_LEFT - CHART_PADDING_RIGHT;
  const plotHeight = CHART_HEIGHT - CHART_PADDING_TOP - CHART_PADDING_BOTTOM;

  const visiblePoints = useMemo(() => {
    return points.filter((point) => point.ts >= visibleFrom && point.ts <= visibleTo);
  }, [points, visibleFrom, visibleTo]);

  const xTicks = useMemo(() => buildXAxisTicks(timeWindow, visibleFrom, visibleTo), [timeWindow, visibleFrom, visibleTo]);

  const yAxis = useMemo(() => {
    const values = visiblePoints
      .flatMap((point) => [point.value, showSecondaryLine ? point.secondaryValue ?? null : null])
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (thresholdLine && Number.isFinite(thresholdLine.value)) {
      values.push(thresholdLine.value);
    }

    return buildNiceYAxis(values, yMode, unit);
  }, [visiblePoints, showSecondaryLine, thresholdLine, yMode, unit]);

  const mapX = (ts: number) => {
    return CHART_PADDING_LEFT + ((ts - visibleFrom) / xRange) * plotWidth;
  };

  const mapY = (value: number) => {
    const normalized = (value - yAxis.min) / Math.max(yAxis.max - yAxis.min, 1e-9);
    return CHART_PADDING_TOP + plotHeight - normalized * plotHeight;
  };

  const barWidth = useMemo(() => {
    if (visiblePoints.length < 2) {
      return 8;
    }

    const sorted = [...visiblePoints].sort((a, b) => a.ts - b.ts);
    let minGap = Infinity;

    for (let i = 1; i < sorted.length; i += 1) {
      minGap = Math.min(minGap, sorted[i].ts - sorted[i - 1].ts);
    }

    if (!Number.isFinite(minGap) || minGap <= 0) {
      return 8;
    }

    return Math.max(4, Math.min(24, (minGap / xRange) * plotWidth * 0.65));
  }, [visiblePoints, plotWidth, xRange]);

  const secondaryPath = useMemo(() => {
    if (!showSecondaryLine) {
      return '';
    }

    let path = '';

    visiblePoints.forEach((point, idx) => {
      if (point.secondaryValue === null || point.secondaryValue === undefined) {
        return;
      }

      const x = mapX(point.ts);
      const y = mapY(point.secondaryValue);
      if (!path) {
        path = `M ${x} ${y}`;
      } else {
        path += ` L ${x} ${y}`;
      }

      if (idx === visiblePoints.length - 1) {
        path += '';
      }
    });

    return path;
  }, [visiblePoints, showSecondaryLine, yAxis.min, yAxis.max, visibleFrom, visibleTo]);

  const primaryTone = tone === 'primary' ? 'rgba(27,77,62,0.8)' : 'rgba(15,23,42,0.8)';
  const secondaryTone = 'rgba(220,38,38,0.95)';
  const thresholdTone = 'rgba(220,38,38,0.7)';

  const hoveredPoint = hoveredIndex !== null ? visiblePoints[hoveredIndex] : null;

  return (
    <div className="bg-white border-2 border-ink p-5 shadow-hard">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-ink/70">{title}</p>
          <p className="text-base font-mono text-ink/70 mt-1">{yLabel}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {showSecondaryLine && <p className="text-sm font-mono text-ink/70">Line: {secondaryLabel}</p>}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono text-ink/70">Zoom</span>
            <input
              type="range"
              min={1}
              max={8}
              step={0.25}
              value={zoomLevel}
              onChange={(event) => setZoomLevel(clampZoom(Number(event.target.value)))}
              className="w-32"
            />
            <span className="font-mono text-ink min-w-[40px] text-right">{zoomLevel.toFixed(2)}x</span>
          </div>
        </div>
      </div>

      {visiblePoints.length === 0 ? (
        <div className="h-64 border-2 border-dashed border-ink/30 flex items-center justify-center text-sm text-ink/60">
          No data points in selected range.
        </div>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            className="w-full h-64 border-2 border-ink bg-paper"
            onMouseLeave={() => setHoveredIndex(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const xRatio = (event.clientX - rect.left) / rect.width;
              const x = CHART_WIDTH * xRatio;

              let nearestIndex = 0;
              let nearestDistance = Number.POSITIVE_INFINITY;

              visiblePoints.forEach((point, idx) => {
                const px = mapX(point.ts);
                const distance = Math.abs(px - x);
                if (distance < nearestDistance) {
                  nearestDistance = distance;
                  nearestIndex = idx;
                }
              });

              setHoveredIndex(nearestIndex);
            }}
            onWheel={(event) => {
              event.preventDefault();
              setZoomLevel((current) => {
                const next = event.deltaY < 0 ? current + 0.25 : current - 0.25;
                return clampZoom(Number(next.toFixed(2)));
              });
            }}
          >
            {yAxis.ticks.map((tick) => (
              <g key={`y-${tick}`}>
                <line
                  x1={CHART_PADDING_LEFT}
                  x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                  y1={mapY(tick)}
                  y2={mapY(tick)}
                  stroke="rgba(15,23,42,0.12)"
                  strokeWidth="1"
                />
                <text
                  x={CHART_PADDING_LEFT - 8}
                  y={mapY(tick) + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="rgba(15,23,42,0.7)"
                >
                  {formatValue(tick, unit)}
                </text>
              </g>
            ))}

            {xTicks.map((tick) => (
              <g key={`x-${tick}`}>
                <line
                  x1={mapX(tick)}
                  x2={mapX(tick)}
                  y1={CHART_PADDING_TOP}
                  y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                  stroke="rgba(15,23,42,0.08)"
                  strokeWidth="1"
                />
                <text
                  x={mapX(tick)}
                  y={CHART_HEIGHT - 12}
                  textAnchor="middle"
                  fontSize="11"
                  fill="rgba(15,23,42,0.7)"
                >
                  {formatXAxisTick(tick, timeWindow)}
                </text>
              </g>
            ))}

            {visiblePoints.map((point, idx) => {
              if (point.value === null || point.value === undefined) {
                return null;
              }

              const xCenter = mapX(point.ts);
              const y = mapY(point.value);
              const baselineY = mapY(yAxis.min);
              const height = Math.max(1, baselineY - y);

              return (
                <rect
                  key={`bar-${point.ts}-${idx}`}
                  x={xCenter - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill={primaryTone}
                  opacity={hoveredIndex === idx ? 1 : 0.85}
                />
              );
            })}

            {showSecondaryLine && secondaryPath && (
              <path d={secondaryPath} fill="none" stroke={secondaryTone} strokeWidth="2" strokeDasharray="4 3" />
            )}

            {thresholdLine && Number.isFinite(thresholdLine.value) && (
              <g>
                <line
                  x1={CHART_PADDING_LEFT}
                  x2={CHART_WIDTH - CHART_PADDING_RIGHT}
                  y1={mapY(thresholdLine.value)}
                  y2={mapY(thresholdLine.value)}
                  stroke={thresholdTone}
                  strokeWidth="2"
                  strokeDasharray="6 4"
                />
                <text
                  x={CHART_WIDTH - CHART_PADDING_RIGHT - 4}
                  y={mapY(thresholdLine.value) - 4}
                  textAnchor="end"
                  fontSize="10"
                  fill="rgba(220,38,38,0.95)"
                >
                  {thresholdLine.label}
                </text>
              </g>
            )}

            {hoveredPoint && (
              <line
                x1={mapX(hoveredPoint.ts)}
                x2={mapX(hoveredPoint.ts)}
                y1={CHART_PADDING_TOP}
                y2={CHART_HEIGHT - CHART_PADDING_BOTTOM}
                stroke="rgba(15,23,42,0.4)"
                strokeWidth="1"
              />
            )}
          </svg>

          {hoveredPoint && (
            <div className="absolute top-2 left-2 bg-white border-2 border-ink px-3 py-2 text-xs font-mono shadow-hard-sm z-10">
              <div className="font-bold text-ink">{new Date(hoveredPoint.ts).toLocaleString()}</div>
              {!tooltipTotalLabel && (
                <div className="text-ink/70">
                  Value: {hoveredPoint.value === null ? 'N/A' : formatValue(hoveredPoint.value, unit, true)}
                </div>
              )}
              {showSecondaryLine && hoveredPoint.secondaryValue !== null && hoveredPoint.secondaryValue !== undefined && (
                <div className="text-red-700">
                  {secondaryLabel}: {formatValue(hoveredPoint.secondaryValue, unit, true)}
                </div>
              )}
              {tooltipTotalLabel && hoveredPoint.value !== null && (
                <div className="text-ink/70">
                  {tooltipTotalLabel}: {formatValue(hoveredPoint.value, unit, true)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ServiceMetricsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId, serviceName } = useParams<{ projectId: string; serviceName: string }>();
  const user = getCurrentUser();
  const decodedServiceName = decodeURIComponent(serviceName || '');

  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [systemMetrics, setSystemMetrics] = useState<SystemMetricPoint[]>([]);
  const [requestMetrics, setRequestMetrics] = useState<RequestMetricPoint[]>([]);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('hours');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [endpointFilter, setEndpointFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<{ from: number; to: number }>(() => {
    const to = Date.now();
    return { from: to - TIME_WINDOW_CONFIG.hours.windowMs, to };
  });
  const [showP95Line, setShowP95Line] = useState(true);
  const [showErrorThreshold, setShowErrorThreshold] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
      return;
    }

    if (!projectId || !decodedServiceName) {
      navigate('/home');
      return;
    }

    loadMetrics();
  }, [navigate, projectId, decodedServiceName, timeWindow]);

  const loadMetrics = async () => {
    if (!projectId || !decodedServiceName) return;

    try {
      setLoading(true);
      setError('');

      const to = Date.now();
      const from = to - TIME_WINDOW_CONFIG[timeWindow].windowMs;
      setTimeRange({ from, to });

      const [systemData, requestData] = await Promise.all([
        getSystemMetrics(projectId, decodedServiceName, from, to),
        getRequestMetrics(projectId, decodedServiceName, from, to),
      ]);

      setSystemMetrics(systemData || []);
      setRequestMetrics(requestData || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load service metrics');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const endpointAggregates = useMemo<EndpointAggregate[]>(() => {
    const grouped = new Map<string, EndpointAggregate & { weightedSum: number; p95Sum: number; p95Count: number }>();

    const source = requestMetrics.filter((metric) => {
      const methodOk = methodFilter === 'all' || metric.method === methodFilter;
      const endpointOk = endpointFilter === 'all' || metric.route === endpointFilter;
      return methodOk && endpointOk;
    });

    for (const metric of source) {
      const method = metric.method || 'GET';
      const route = metric.route || '/';
      const key = `${method} ${route}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          key,
          method,
          route,
          totalRequests: metric.totalRequests || 0,
          successCount: metric.successCount || 0,
          clientErrorCount: metric.clientErrorCount || 0,
          serverErrorCount: metric.serverErrorCount || 0,
          avgResponseTime: 0,
          maxResponseTime: metric.maxResponseTime || 0,
          p95ResponseTime: 0,
          weightedSum: (metric.avgResponseTime || 0) * (metric.totalRequests || 0),
          p95Sum: metric.p95ResponseTime || 0,
          p95Count: 1,
        });
      } else {
        existing.totalRequests += metric.totalRequests || 0;
        existing.successCount += metric.successCount || 0;
        existing.clientErrorCount += metric.clientErrorCount || 0;
        existing.serverErrorCount += metric.serverErrorCount || 0;
        existing.maxResponseTime = Math.max(existing.maxResponseTime, metric.maxResponseTime || 0);
        existing.weightedSum += (metric.avgResponseTime || 0) * (metric.totalRequests || 0);
        existing.p95Sum += metric.p95ResponseTime || 0;
        existing.p95Count += 1;
      }
    }

    return Array.from(grouped.values())
      .map((item) => ({
        key: item.key,
        method: item.method,
        route: item.route,
        totalRequests: item.totalRequests,
        successCount: item.successCount,
        clientErrorCount: item.clientErrorCount,
        serverErrorCount: item.serverErrorCount,
        avgResponseTime: item.totalRequests > 0 ? item.weightedSum / item.totalRequests : 0,
        maxResponseTime: item.maxResponseTime,
        p95ResponseTime: item.p95Count > 0 ? item.p95Sum / item.p95Count : 0,
      }))
      .sort((a, b) => b.totalRequests - a.totalRequests);
  }, [requestMetrics, methodFilter, endpointFilter]);

  const methodOptions = useMemo(() => {
    return Array.from(new Set(requestMetrics.map((metric) => metric.method).filter(Boolean))).sort();
  }, [requestMetrics]);

  const endpointOptions = useMemo(() => {
    const byMethod = requestMetrics.filter((metric) => methodFilter === 'all' || metric.method === methodFilter);
    return Array.from(new Set(byMethod.map((metric) => metric.route).filter(Boolean))).sort();
  }, [requestMetrics, methodFilter]);

  useEffect(() => {
    if (methodFilter !== 'all' && !methodOptions.includes(methodFilter)) {
      setMethodFilter('all');
    }
  }, [methodFilter, methodOptions]);

  useEffect(() => {
    if (endpointFilter !== 'all' && !endpointOptions.includes(endpointFilter)) {
      setEndpointFilter('all');
    }
  }, [endpointFilter, endpointOptions]);

  const expectedBuckets = useMemo(() => {
    return buildExpectedBuckets(timeRange.from, timeRange.to, getBucketIntervalMs(timeWindow));
  }, [timeRange.from, timeRange.to, timeWindow]);

  const systemCpuSeries = useMemo<TimeSeriesPoint[]>(() => {
    const byBucket = new Map<number, number>();
    systemMetrics.forEach((point) => {
      byBucket.set(toNumberBucket(point.bucket), point.avgCpu);
    });

    return expectedBuckets.map((ts) => ({
      ts,
      value: byBucket.get(ts) ?? null,
    }));
  }, [systemMetrics, expectedBuckets]);

  const systemMemorySeries = useMemo<TimeSeriesPoint[]>(() => {
    const byBucket = new Map<number, number>();
    systemMetrics.forEach((point) => {
      byBucket.set(toNumberBucket(point.bucket), point.avgMemoryMb);
    });

    return expectedBuckets.map((ts) => ({
      ts,
      value: byBucket.get(ts) ?? null,
    }));
  }, [systemMetrics, expectedBuckets]);

  const filteredRequestMetrics = useMemo(() => {
    return requestMetrics.filter((metric) => {
      const methodOk = methodFilter === 'all' || metric.method === methodFilter;
      const endpointOk = endpointFilter === 'all' || metric.route === endpointFilter;
      return methodOk && endpointOk;
    });
  }, [requestMetrics, methodFilter, endpointFilter]);

  const requestTimeline = useMemo(() => {
    const grouped = new Map<
      number,
      {
        totalRequests: number;
        totalErrors: number;
        weightedLatencySum: number;
        weightedP95Sum: number;
      }
    >();

    for (const point of filteredRequestMetrics) {
      const bucket = toNumberBucket(point.minuteBucket ?? point.hourBucket ?? point.dayBucket);
      const existing = grouped.get(bucket);
      const totalRequests = point.totalRequests || 0;
      const totalErrors = (point.clientErrorCount || 0) + (point.serverErrorCount || 0);

      if (!existing) {
        grouped.set(bucket, {
          totalRequests,
          totalErrors,
          weightedLatencySum: (point.avgResponseTime || 0) * totalRequests,
          weightedP95Sum: (point.p95ResponseTime || 0) * totalRequests,
        });
      } else {
        existing.totalRequests += totalRequests;
        existing.totalErrors += totalErrors;
        existing.weightedLatencySum += (point.avgResponseTime || 0) * totalRequests;
        existing.weightedP95Sum += (point.p95ResponseTime || 0) * totalRequests;
      }
    }

    return expectedBuckets.map((bucket) => {
      const data = grouped.get(bucket);
      const totalRequests = data?.totalRequests ?? 0;
      const totalErrors = data?.totalErrors ?? 0;

      const avgLatency = totalRequests > 0 && data ? data.weightedLatencySum / totalRequests : null;
      const p95Latency = totalRequests > 0 && data ? data.weightedP95Sum / totalRequests : null;
      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
      const uptime = 100 - errorRate;

      return {
        bucket,
        totalRequests,
        avgLatency,
        p95Latency,
        errorRate,
        uptime,
      };
    });
  }, [filteredRequestMetrics, expectedBuckets]);

  const requestCountSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.totalRequests,
    }));
  }, [requestTimeline]);

  const requestLatencySeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.avgLatency,
      secondaryValue: point.p95Latency,
    }));
  }, [requestTimeline]);

  const requestErrorRateSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.errorRate,
    }));
  }, [requestTimeline]);

  const requestUptimeSeries = useMemo<TimeSeriesPoint[]>(() => {
    return requestTimeline.map((point) => ({
      ts: point.bucket,
      value: point.uptime,
    }));
  }, [requestTimeline]);

  const latestSystem = systemMetrics[systemMetrics.length - 1];

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="w-64 shrink-0 bg-white border-r-4 border-ink flex flex-col">
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper border-2 border-ink">
              <span className="text-base font-bold">BM</span>
            </div>
            <span className="text-xl font-black uppercase tracking-tight">BackendMonitor</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('system')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-base uppercase tracking-wide transition-colors ${
              activeTab === 'system' ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
            }`}
          >
            System Metrics
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-base uppercase tracking-wide transition-colors ${
              activeTab === 'request' ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
            }`}
          >
            Request Metrics
          </button>
        </nav>

        <div className="p-4 border-t-2 border-ink space-y-2">
          <button
            onClick={() => navigate(`/dashboard/${projectId}`)}
            className="w-full px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-sm uppercase tracking-wide"
          >
            Back to Project
          </button>
          <div className="flex items-center justify-between p-3 bg-paper border-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-ink font-bold text-sm">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-sm font-bold truncate max-w-[180px]">{user?.email || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="text-sm text-ink/60 hover:text-ink font-bold" title="Logout">
              ↗
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-4 border-ink px-8 py-6">
          <h1 className="text-3xl font-black uppercase tracking-tight mb-1">{decodedServiceName}</h1>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <p className="text-base text-ink/60 font-mono">Service Metrics ({TIME_WINDOW_CONFIG[timeWindow].subtitle})</p>
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(TIME_WINDOW_CONFIG) as TimeWindow[]).map((windowKey) => (
                <button
                  key={windowKey}
                  onClick={() => setTimeWindow(windowKey)}
                  className={`px-3 py-2 border-2 border-ink text-sm font-bold uppercase tracking-wide ${
                    timeWindow === windowKey ? 'bg-primary text-white shadow-hard' : 'bg-white text-ink hover:bg-paper'
                  }`}
                >
                  {TIME_WINDOW_CONFIG[windowKey].label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-ink border-t-primary animate-spin"></div>
                <p className="mt-4 text-base font-bold uppercase tracking-wide text-ink/60">Loading Metrics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white border-2 border-ink p-6 max-w-xl">
              <p className="text-base font-bold text-red-600">{error}</p>
              <button
                onClick={() => navigate(`/dashboard/${projectId}`)}
                className="mt-4 px-4 py-2 border-2 border-ink bg-paper hover:bg-white font-bold text-sm uppercase tracking-wide"
              >
                Back to Project
              </button>
            </div>
          ) : activeTab === 'system' ? (
            <section className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">System Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-2">Avg CPU</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgCpu.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-sm font-bold uppercase tracking-wide text-ink/60 mb-2">Avg Memory</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgMemoryMb.toFixed(1)} MB` : 'N/A'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <VolumeTimeChart
                  title="CPU Trend"
                  yLabel="CPU (%)"
                  unit="percent"
                  points={systemCpuSeries}
                  tone="primary"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                />
                <VolumeTimeChart
                  title="Memory Trend"
                  yLabel="Memory (MB)"
                  unit="mb"
                  points={systemMemorySeries}
                  tone="ink"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                />
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h2 className="text-lg font-black uppercase tracking-tight">System Metrics Buckets</h2>
                </div>
                {systemMetrics.length === 0 ? (
                  <div className="p-8 text-base text-ink/60">No system metrics collected yet.</div>
                ) : (
                  <div className="divide-y-2 divide-ink overflow-x-auto">
                    <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div>Bucket</div>
                      <div>Avg CPU</div>
                      <div>Max CPU</div>
                      <div>Avg Memory</div>
                      <div>Max Memory</div>
                    </div>
                    {systemMetrics.map((point, idx) => (
                      <div key={`${String(point.bucket)}-${idx}`} className="grid grid-cols-5 gap-4 px-5 py-4 items-center text-sm font-mono text-ink/70">
                        <div>{new Date(Number(point.bucket)).toLocaleString()}</div>
                        <div>{point.avgCpu.toFixed(2)}%</div>
                        <div>{point.maxCpu.toFixed(2)}%</div>
                        <div>{point.avgMemoryMb.toFixed(2)} MB</div>
                        <div>{point.maxMemoryMb.toFixed(2)} MB</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="space-y-6">
              <h2 className="text-xl font-black uppercase tracking-tight">Request Metrics</h2>
              <div className="bg-white border-2 border-ink p-5 shadow-hard">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Method Filter</label>
                    <select
                      value={methodFilter}
                      onChange={(event) => {
                        setMethodFilter(event.target.value);
                        setEndpointFilter('all');
                      }}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      <option value="all">All Methods</option>
                      {methodOptions.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-bold uppercase tracking-wide text-ink/70 mb-2">Endpoint Filter</label>
                    <select
                      value={endpointFilter}
                      onChange={(event) => setEndpointFilter(event.target.value)}
                      className="w-full border-2 border-ink bg-white px-3 py-2 text-base font-mono"
                    >
                      <option value="all">All Endpoints</option>
                      {endpointOptions.map((endpoint) => (
                        <option key={endpoint} value={endpoint}>
                          {endpoint}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-4 text-sm font-mono text-ink/70">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showP95Line}
                      onChange={(event) => setShowP95Line(event.target.checked)}
                    />
                    Show p95 latency line
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={showErrorThreshold}
                      onChange={(event) => setShowErrorThreshold(event.target.checked)}
                    />
                    Show 5% error threshold
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <VolumeTimeChart
                  title="Request Count"
                  yLabel="Requests / minute"
                  unit="requests"
                  points={requestCountSeries}
                  tone="primary"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  tooltipTotalLabel="Total Requests"
                />
                <VolumeTimeChart
                  title="Latency"
                  yLabel="Latency (ms)"
                  unit="ms"
                  points={requestLatencySeries}
                  tone="ink"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  showSecondaryLine={showP95Line}
                  secondaryLabel="p95"
                />
                <VolumeTimeChart
                  title="Error Rate"
                  yLabel="Error rate (%)"
                  unit="percent"
                  points={requestErrorRateSeries}
                  tone="ink"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  yMode="percent"
                  thresholdLine={showErrorThreshold ? { value: 5, label: '5% threshold' } : undefined}
                />
                <VolumeTimeChart
                  title="Uptime"
                  yLabel="Uptime (%)"
                  unit="percent"
                  points={requestUptimeSeries}
                  tone="primary"
                  from={timeRange.from}
                  to={timeRange.to}
                  timeWindow={timeWindow}
                  yMode="uptime"
                />
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h2 className="text-lg font-black uppercase tracking-tight">Endpoint-wise Request Metrics</h2>
                </div>

                {endpointAggregates.length === 0 ? (
                  <div className="p-8 text-base text-ink/60">No request metrics collected for selected filters.</div>
                ) : (
                  <div className="divide-y-2 divide-ink overflow-x-auto">
                    <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div className="col-span-1">Method</div>
                      <div className="col-span-3">Endpoint</div>
                      <div className="col-span-2">Requests</div>
                      <div className="col-span-2">Success</div>
                      <div className="col-span-2">Errors</div>
                      <div className="col-span-2">Avg Latency</div>
                    </div>

                    {endpointAggregates.map((row) => (
                      <div key={row.key} className="grid grid-cols-12 gap-4 px-5 py-4 items-center text-sm font-mono text-ink/70">
                        <div className="col-span-1 font-bold">{row.method}</div>
                        <div className="col-span-3">{row.route}</div>
                        <div className="col-span-2">{row.totalRequests}</div>
                        <div className="col-span-2">{row.successCount}</div>
                        <div className="col-span-2">{row.clientErrorCount + row.serverErrorCount}</div>
                        <div className="col-span-2">{row.avgResponseTime.toFixed(2)} ms</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default ServiceMetricsPage;
