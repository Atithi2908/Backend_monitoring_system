import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout, getCurrentUser, isAuthenticated } from '../services/auth';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = getCurrentUser();

  useEffect(() => {
    if (!isAuthenticated()) {
      navigate('/');
    }
  }, [navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      {/* Header */}
      <header className="bg-ink text-paper border-b-4 border-primary">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center bg-paper text-ink">
                  <span className="text-sm font-bold">BM</span>
                </div>
                <span className="text-2xl font-black uppercase tracking-tight">
                  BackendMonitor
                </span>
              </div>
              <p className="text-sm text-paper/60 font-mono">
                Real-time observability dashboard
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-4 py-2 border border-paper/20 bg-paper/10">
                <span className="w-2 h-2 bg-primary-bright rounded-full animate-pulse"></span>
                <span className="text-xs font-mono font-bold uppercase tracking-widest">
                  Live
                </span>
              </div>
              {user && (
                <div className="px-4 py-2 border border-paper/20 bg-paper/10">
                  <span className="text-xs font-mono text-paper/80">
                    {user.email}
                  </span>
                </div>
              )}
              <button 
                onClick={handleLogout}
                className="bg-paper text-ink px-6 py-2.5 text-sm font-bold uppercase tracking-wide hover:bg-primary hover:text-white transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-[1600px] px-6 py-8">
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          
          {/* API Latency */}
          <div className="bg-white border-2 border-ink shadow-hard p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                API Latency
              </h3>
              <span className="text-primary-bright">▲</span>
            </div>
            <p className="text-4xl font-black font-mono mb-2">24ms</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary-bright font-bold">↓ 12%</span>
              <span className="text-ink/60">vs last hour</span>
            </div>
          </div>

          {/* Request Rate */}
          <div className="bg-white border-2 border-ink shadow-hard p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Request Rate
              </h3>
              <span className="text-primary-bright">▲</span>
            </div>
            <p className="text-4xl font-black font-mono mb-2">5.1k/s</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary-bright font-bold">↑ 8%</span>
              <span className="text-ink/60">vs last hour</span>
            </div>
          </div>

          {/* Error Rate */}
          <div className="bg-white border-2 border-ink shadow-hard p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Error Rate
              </h3>
              <span className="text-red-500">▼</span>
            </div>
            <p className="text-4xl font-black font-mono mb-2">0.02%</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-500 font-bold">↑ 0.01%</span>
              <span className="text-ink/60">vs last hour</span>
            </div>
          </div>

          {/* Active Connections */}
          <div className="bg-white border-2 border-ink shadow-hard p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink/60">
                Active Connections
              </h3>
              <span className="text-primary-bright">▲</span>
            </div>
            <p className="text-4xl font-black font-mono mb-2">342</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-primary-bright font-bold">↑ 23</span>
              <span className="text-ink/60">vs last hour</span>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column - Large Chart */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Request Timeline */}
            <div className="bg-white border-2 border-ink shadow-hard">
              <div className="border-b-2 border-ink p-6">
                <h2 className="text-lg font-bold uppercase tracking-tight">
                  Request Timeline
                </h2>
                <p className="text-xs text-ink/60 mt-1">
                  Last 24 hours • Updated every 10 seconds
                </p>
              </div>
              <div className="p-6 bg-grid-pattern min-h-[300px] flex items-end gap-2">
                {/* Mock Chart Bars */}
                {Array.from({ length: 24 }).map((_, i) => {
                  const height = Math.random() * 100 + 50;
                  return (
                    <div 
                      key={i} 
                      className="flex-1 bg-primary hover:bg-primary-bright transition-colors cursor-pointer border-2 border-ink"
                      style={{ height: `${height}px` }}
                      title={`${Math.floor(height * 50)} requests`}
                    ></div>
                  );
                })}
              </div>
              <div className="border-t-2 border-ink p-4 bg-ink text-paper flex items-center justify-between text-xs font-mono">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>

            {/* Top Endpoints */}
            <div className="bg-white border-2 border-ink shadow-hard">
              <div className="border-b-2 border-ink p-6">
                <h2 className="text-lg font-bold uppercase tracking-tight">
                  Top Endpoints
                </h2>
                <p className="text-xs text-ink/60 mt-1">
                  Most active routes in last hour
                </p>
              </div>
              <div className="divide-y-2 divide-ink">
                {[
                  { method: 'GET', path: '/api/metrics', hits: '2.3k', avg: '12ms', status: 200 },
                  { method: 'POST', path: '/api/collect', hits: '1.8k', avg: '24ms', status: 200 },
                  { method: 'GET', path: '/api/overview', hits: '892', avg: '45ms', status: 200 },
                  { method: 'GET', path: '/api/debug', hits: '234', avg: '18ms', status: 200 },
                  { method: 'POST', path: '/api/auth/login', hits: '156', avg: '67ms', status: 201 },
                ].map((endpoint, i) => (
                  <div key={i} className="p-4 hover:bg-paper transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <span className="text-xs font-bold font-mono px-2 py-1 bg-primary text-white">
                          {endpoint.method}
                        </span>
                        <span className="text-sm font-mono font-semibold flex-1">
                          {endpoint.path}
                        </span>
                      </div>
                      <div className="flex items-center gap-6 text-xs">
                        <div className="text-right">
                          <div className="font-bold font-mono">{endpoint.hits}</div>
                          <div className="text-ink/60">hits</div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold font-mono">{endpoint.avg}</div>
                          <div className="text-ink/60">avg</div>
                        </div>
                        <div className={`w-16 text-center font-bold ${endpoint.status === 200 || endpoint.status === 201 ? 'text-primary-bright' : 'text-red-500'}`}>
                          {endpoint.status}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Panels */}
          <div className="space-y-6">
            
            {/* System Health */}
            <div className="bg-white border-2 border-ink shadow-hard">
              <div className="border-b-2 border-ink p-4">
                <h3 className="text-sm font-bold uppercase tracking-tight">
                  System Health
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { name: 'Backend Monitor SDK', status: 'Collecting', color: 'bg-primary-bright' },
                  { name: 'Request Metrics', status: 'Active', color: 'bg-primary-bright' },
                  { name: 'System Metrics', status: 'Active', color: 'bg-primary-bright' },
                  { name: 'API Health', status: 'Healthy', color: 'bg-primary-bright' },
                ].map((service, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${service.color}`}></div>
                      <span className="font-semibold">{service.name}</span>
                    </div>
                    <span className="text-ink/60 font-mono">{service.status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Errors */}
            <div className="bg-white border-2 border-ink shadow-hard">
              <div className="border-b-2 border-ink p-4 bg-red-50">
                <h3 className="text-sm font-bold uppercase tracking-tight">
                  Recent Errors
                </h3>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { code: 500, endpoint: '/api/process', time: '2m ago' },
                  { code: 429, endpoint: '/api/collect', time: '5m ago' },
                  { code: 404, endpoint: '/api/unknown', time: '12m ago' },
                ].map((error, i) => (
                  <div key={i} className="border-l-4 border-red-500 pl-3 py-2 bg-red-50/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-red-600">{error.code}</span>
                      <span className="text-xs text-ink/60 font-mono">{error.time}</span>
                    </div>
                    <p className="text-xs font-mono text-ink/80">{error.endpoint}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-ink text-paper border-2 border-ink shadow-hard p-6 space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-tight mb-4">
                Quick Actions
              </h3>
              <button className="w-full bg-paper text-ink px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-paper/90 transition-colors">
                Export Logs
              </button>
              <button className="w-full bg-paper text-ink px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-paper/90 transition-colors">
                Generate Report
              </button>
              <button className="w-full bg-paper text-ink px-4 py-3 text-xs font-bold uppercase tracking-wide hover:bg-paper/90 transition-colors">
                API Settings
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
