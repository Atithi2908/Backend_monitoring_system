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
  }, [navigate, projectId, decodedServiceName]);

  const loadMetrics = async () => {
    if (!projectId || !decodedServiceName) return;

    try {
      setLoading(true);
      setError('');

      const to = Date.now();
      const from = to - 24 * 60 * 60 * 1000;

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

    for (const metric of requestMetrics) {
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
  }, [requestMetrics]);

  const latestSystem = systemMetrics[systemMetrics.length - 1];

  return (
    <div className="min-h-screen bg-paper text-ink flex">
      <aside className="w-64 bg-white border-r-4 border-ink flex flex-col">
        <div className="p-6 border-b-2 border-ink">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center bg-ink text-paper border-2 border-ink">
              <span className="text-sm font-bold">BM</span>
            </div>
            <span className="text-xl font-black uppercase tracking-tight">BackendMonitor</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <button
            onClick={() => setActiveTab('system')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors ${
              activeTab === 'system' ? 'bg-primary text-white shadow-hard' : 'bg-white hover:bg-paper text-ink'
            }`}
          >
            System Metrics
          </button>
          <button
            onClick={() => setActiveTab('request')}
            className={`w-full text-left px-4 py-3 border-2 border-ink font-bold text-sm uppercase tracking-wide transition-colors ${
              activeTab === 'request' ? 'bg-primary text-white shadow-hard' : 'bg-white hover:bg-paper text-ink'
            }`}
          >
            Request Metrics
          </button>
        </nav>

        <div className="p-4 border-t-2 border-ink space-y-2">
          <button
            onClick={() => navigate(`/dashboard/${projectId}`)}
            className="w-full px-4 py-3 border-2 border-ink bg-white hover:bg-paper text-ink font-bold text-xs uppercase tracking-wide"
          >
            Back to Project
          </button>
          <div className="flex items-center justify-between p-3 bg-paper border-2 border-ink">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary text-white flex items-center justify-center border-2 border-ink font-bold text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="text-xs font-bold truncate max-w-[120px]">{user?.email || 'User'}</span>
            </div>
            <button onClick={handleLogout} className="text-xs text-ink/60 hover:text-ink font-bold" title="Logout">
              ↗
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="bg-white border-b-4 border-ink px-8 py-6">
          <h1 className="text-3xl font-black uppercase tracking-tight mb-1">{decodedServiceName}</h1>
          <p className="text-sm text-ink/60 font-mono">Service Metrics (last 24 hours)</p>
        </header>

        <main className="flex-1 overflow-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="inline-block w-12 h-12 border-4 border-ink border-t-primary animate-spin"></div>
                <p className="mt-4 text-sm font-bold uppercase tracking-wide text-ink/60">Loading Metrics...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white border-2 border-ink p-6 max-w-xl">
              <p className="text-sm font-bold text-red-600">{error}</p>
              <button
                onClick={() => navigate(`/dashboard/${projectId}`)}
                className="mt-4 px-4 py-2 border-2 border-ink bg-paper hover:bg-white font-bold text-xs uppercase tracking-wide"
              >
                Back to Project
              </button>
            </div>
          ) : activeTab === 'system' ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/60 mb-2">Avg CPU</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgCpu.toFixed(1)}%` : 'N/A'}</p>
                </div>
                <div className="bg-white border-2 border-ink p-5 shadow-hard">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink/60 mb-2">Avg Memory</p>
                  <p className="text-3xl font-black font-mono">{latestSystem ? `${latestSystem.avgMemoryMb.toFixed(1)} MB` : 'N/A'}</p>
                </div>
              </div>

              <div className="bg-white border-2 border-ink shadow-hard">
                <div className="border-b-2 border-ink p-5 bg-paper">
                  <h2 className="text-lg font-black uppercase tracking-tight">System Metrics Buckets</h2>
                </div>
                {systemMetrics.length === 0 ? (
                  <div className="p-8 text-sm text-ink/60">No system metrics collected yet.</div>
                ) : (
                  <div className="divide-y-2 divide-ink">
                    <div className="grid grid-cols-5 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                      <div>Bucket</div>
                      <div>Avg CPU</div>
                      <div>Max CPU</div>
                      <div>Avg Memory</div>
                      <div>Max Memory</div>
                    </div>
                    {systemMetrics.map((point, idx) => (
                      <div key={`${String(point.bucket)}-${idx}`} className="grid grid-cols-5 gap-4 px-5 py-4 items-center text-xs font-mono text-ink/70">
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
            </div>
          ) : (
            <div className="bg-white border-2 border-ink shadow-hard">
              <div className="border-b-2 border-ink p-5 bg-paper">
                <h2 className="text-lg font-black uppercase tracking-tight">Endpoint-wise Request Metrics</h2>
              </div>

              {endpointAggregates.length === 0 ? (
                <div className="p-8 text-sm text-ink/60">No request metrics collected yet.</div>
              ) : (
                <div className="divide-y-2 divide-ink">
                  <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-paper text-[11px] font-bold uppercase tracking-wide text-ink/70">
                    <div className="col-span-1">Method</div>
                    <div className="col-span-3">Endpoint</div>
                    <div className="col-span-2">Requests</div>
                    <div className="col-span-2">Success</div>
                    <div className="col-span-2">Errors</div>
                    <div className="col-span-2">Avg Latency</div>
                  </div>

                  {endpointAggregates.map((row) => (
                    <div key={row.key} className="grid grid-cols-12 gap-4 px-5 py-4 items-center text-xs font-mono text-ink/70">
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
          )}
        </main>
      </div>
    </div>
  );
};

export default ServiceMetricsPage;
