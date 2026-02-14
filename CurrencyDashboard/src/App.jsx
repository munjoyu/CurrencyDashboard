import React, { useState } from 'react'
import AnchorCurrencyDashboard from './components/AnchorCurrencyDashboard'
import UltimateEconomySim from './components/UltimateEconomySim'
import { DollarSign, Wallet } from 'lucide-react'

function App() {
    const [view, setView] = useState('anchor')

    return (
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

            {/* Content */}
            <div className="min-h-[calc(100vh-73px)]">
                {view === 'anchor' ? <AnchorCurrencyDashboard /> : <UltimateEconomySim />}
            </div>
        </div>
    )
}

export default App
