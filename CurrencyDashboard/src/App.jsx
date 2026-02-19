import React, { useState, useEffect } from 'react'
import AnchorCurrencyDashboard from './components/AnchorCurrencyDashboard'
import UltimateEconomySim from './components/UltimateEconomySim'
import { DollarSign, Wallet, Activity } from 'lucide-react'

function App() {
    const [view, setView] = useState('anchor')
    const [healthStatus, setHealthStatus] = useState('checking')
    const [statsVisible, setStatsVisible] = useState(false)
    const [stats, setStats] = useState(null)

    // Poll health status every 5 seconds
    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787'
                const response = await fetch(`${apiUrl}/api/health`)
                if (response.ok) {
                    const data = await response.json()
                    setHealthStatus(data.status)
                } else {
                    setHealthStatus('unhealthy')
                }
            } catch (error) {
                setHealthStatus('unreachable')
            }
        }

        fetchHealth()
        const interval = setInterval(fetchHealth, 5000)
        return () => clearInterval(interval)
    }, [])

    // Fetch stats when requested
    const handleViewStats = async () => {
        try {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787'
            const response = await fetch(`${apiUrl}/api/stats`)
            if (response.ok) {
                const data = await response.json()
                setStats(data)
                setStatsVisible(true)
            }
        } catch (error) {
            console.error('Failed to fetch stats:', error)
        }
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'healthy': return 'bg-green-500/20 text-green-400 border-green-500/50'
            case 'degraded': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
            case 'unhealthy': return 'bg-red-500/20 text-red-400 border-red-500/50'
            case 'unreachable': return 'bg-gray-500/20 text-gray-400 border-gray-500/50'
            default: return 'bg-blue-500/20 text-blue-400 border-blue-500/50'
        }
    }

    const getStatusIcon = (status) => {
        switch (status) {
            case 'healthy': return '🟢'
            case 'degraded': return '🟡'
            case 'unhealthy': return '🔴'
            case 'unreachable': return '⚪'
            default: return '🔷'
        }
    }

    return (
        <>
            {/* Main Container */}
            <div className="min-h-screen bg-slate-950">
                {/* Navigation Bar */}
                <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <a href="/" className="flex items-center gap-2 text-white hover:text-amber-400 transition-colors">
                                <DollarSign className="w-6 h-6 text-amber-500" />
                                <span className="font-bold text-lg">CurrencyDashboard</span>
                            </a>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Health Status Badge */}
                            <div className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 ${getStatusColor(healthStatus)}`}>
                                <span>{getStatusIcon(healthStatus)}</span>
                                <span>{healthStatus === 'checking' ? '확인 중... ' : `API ${healthStatus}`}</span>
                            </div>

                            {/* Stats Button */}
                            <button
                                onClick={handleViewStats}
                                className="px-3 py-1.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1"
                                title="View server statistics"
                            >
                                <Activity className="w-4 h-4" />
                                Stats
                            </button>

                            {/* Dashboard Tabs */}
                            <div className="flex items-center gap-2 bg-slate-800/50 p-1 rounded-lg border border-slate-700">
                                <button
                                    onClick={() => setView('anchor')}
                                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                                        view === 'anchor'
                                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/50'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <DollarSign className="w-4 h-4" />
                                        기축통화 교육
                                    </span>
                                </button>
                                <button
                                    onClick={() => setView('simulator')}
                                    className={`px-4 py-2 rounded-md font-medium transition-all ${
                                        view === 'simulator'
                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50'
                                            : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                >
                                    <span className="flex items-center gap-2">
                                        <Wallet className="w-4 h-4" />
                                        투자 시뮬레이터
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="min-h-[calc(100vh-73px)]">
                    {view === 'anchor' ? <AnchorCurrencyDashboard /> : <UltimateEconomySim />}
                </div>
            </div>

            {/* Stats Modal */}
            {statsVisible && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-auto">
                        <div className="sticky top-0 bg-slate-800 px-6 py-4 border-b border-slate-700 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-white">📊 Server Statistics</h2>
                            <button
                                onClick={() => setStatsVisible(false)}
                                className="text-slate-400 hover:text-white text-2xl leading-none"
                            >
                                ×
                            </button>
                        </div>

                        {stats && (
                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                        <div className="text-slate-400 text-sm mb-1">Total Requests</div>
                                        <div className="text-2xl font-bold text-white">{stats.requests_total}</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                        <div className="text-slate-400 text-sm mb-1">Last 5 Minutes</div>
                                        <div className="text-2xl font-bold text-white">{stats.requests_last_5min}</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                        <div className="text-slate-400 text-sm mb-1">Error Rate</div>
                                        <div className="text-2xl font-bold text-red-400">{stats.error_rate_percent}%</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg">
                                        <div className="text-slate-400 text-sm mb-1">Avg Latency</div>
                                        <div className="text-2xl font-bold text-blue-400">{stats.avg_latency_ms}ms</div>
                                    </div>
                                    <div className="bg-slate-800/50 p-4 rounded-lg col-span-2">
                                        <div className="text-slate-400 text-sm mb-1">Cache Hit Rate</div>
                                        <div className="text-2xl font-bold text-green-400">{stats.cache_hit_rate_percent}%</div>
                                    </div>
                                </div>

                                {stats.top_endpoints && stats.top_endpoints.length > 0 && (
                                    <div className="mt-6">
                                        <h3 className="text-lg font-semibold text-white mb-3">Top 5 Endpoints</h3>
                                        <div className="space-y-2">
                                            {stats.top_endpoints.map((ep, idx) => (
                                                <div key={idx} className="bg-slate-800/50 p-3 rounded-lg text-sm">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-slate-300 font-mono">{ep.endpoint}</span>
                                                        <span className="text-slate-400">{ep.count} requests</span>
                                                    </div>
                                                    <div className="flex justify-between text-xs text-slate-500">
                                                        <span>Errors: {ep.errors}</span>
                                                        <span>Avg: {ep.avg_latency_ms}ms</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}

export default App
