import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const UltimateEconomySim = () => {
    const [fedRate, setFedRate] = useState(2.5);
    const [data, setData] = useState([]);
    const [aiAnalysis, setAiAnalysis] = useState('');
    const [advancedBriefing, setAdvancedBriefing] = useState(null);
    const [analysisError, setAnalysisError] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [cacheStatus, setCacheStatus] = useState(null);
    const [riskProfile, setRiskProfile] = useState('balanced');
    const [investmentHorizonMonths, setInvestmentHorizonMonths] = useState(12);
    const [investorMemo, setInvestorMemo] = useState('');
    const [clientId] = useState(`client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

    useEffect(() => {
        const generatePoints = () => {
            const points = [];
            for (let i = 0; i <= 10; i++) {
                const exchangeRate = 1100 + (fedRate * 80) + (i * 10);
                const stockUsd = 100 + (i * 8) - (fedRate * 2);
                const goldUsd = 100 + (i * 15) + (fedRate < 3 ? 20 : -5);
                const stockKrw = (stockUsd * (exchangeRate / 1200)).toFixed(1);
                const goldKrw = (goldUsd * (exchangeRate / 1200)).toFixed(1);

                points.push({
                    name: `T+${i}`,
                    exchangeRate: Number(exchangeRate.toFixed(0)),
                    stockKrw: parseFloat(stockKrw),
                    goldKrw: parseFloat(goldKrw),
                    bond: Number((100 - (fedRate * 5) + i).toFixed(1))
                });
            }
            setData(points);
        };

        generatePoints();
    }, [fedRate]);

    const latestPoint = data[data.length - 1];

    const handleAiAnalysis = async () => {
        if (!latestPoint || isAnalyzing) {
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError('');
        setCacheStatus(null);
        setAdvancedBriefing(null);

        try {
            const response = await fetch('/api/analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Id': clientId
                },
                body: JSON.stringify({
                    fedRate,
                    exchangeRate: latestPoint.exchangeRate,
                    stockKrw: latestPoint.stockKrw,
                    goldKrw: latestPoint.goldKrw,
                    bond: latestPoint.bond
                })
            });

            const result = await response.json();

            if (response.status === 429) {
                throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
            }

            if (!response.ok) {
                throw new Error(result.error || '분석 요청에 실패했습니다.');
            }

            setAiAnalysis(result.analysis);
            setCacheStatus({
                cached: result.cached || false,
                timestamp: new Date().toLocaleTimeString('ko-KR')
            });
        } catch (error) {
            setAnalysisError(error.message || 'OpenAI 분석을 불러오지 못했습니다.');
            setCacheStatus(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleAdvancedBriefing = async () => {
        if (!latestPoint || isAnalyzing) {
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError('');
        setAiAnalysis('');

        try {
            const response = await fetch('/api/analysis/advanced', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Client-Id': clientId
                },
                body: JSON.stringify({
                    fedRate,
                    exchangeRate: latestPoint.exchangeRate,
                    stockKrw: latestPoint.stockKrw,
                    goldKrw: latestPoint.goldKrw,
                    bond: latestPoint.bond,
                    riskProfile,
                    investmentHorizonMonths,
                    investorMemo
                })
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || '고급 브리핑 생성에 실패했습니다.');
            }

            setAdvancedBriefing(result.briefing);
            setCacheStatus({
                cached: false,
                timestamp: new Date().toLocaleTimeString('ko-KR')
            });
        } catch (error) {
            setAnalysisError(error.message || '고급 브리핑을 불러오지 못했습니다.');
            setAdvancedBriefing(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: '16px', fontFamily: 'sans-serif' }}>
            <h2 style={{ color: '#38bdf8', marginBottom: '24px' }}>🇰🇷 한-미 금리/환율 자산 시뮬레이터 (OpenAI Product Edition)</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px' }}>
                    <p style={{ marginBottom: '10px', fontSize: '1.1rem' }}>🇺🇸 <strong>미국 연준 금리: {fedRate}%</strong></p>
                    <input
                        type="range" min="0" max="10" step="0.25"
                        value={fedRate}
                        onChange={(e) => setFedRate(parseFloat(e.target.value))}
                        style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                    />
                    <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '10px' }}>
                        * 금리 상승 → 달러 가치 상승 → <strong>원/달러 환율 상승</strong>
                    </p>
                </div>
                <div style={{ background: '#0369a1', padding: '20px', borderRadius: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#e0f2fe' }}>예상 환율 (USD/KRW)</span>
                    <h1 style={{ margin: '5px 0', fontSize: '2rem', fontWeight: 'bold' }}>₩{latestPoint?.exchangeRate}</h1>
                </div>
            </div>

            <div style={{ height: '400px', background: '#fff', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} />
                        <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }} />
                        <Legend wrapperStyle={{ paddingTop: '20px' }} />
                        <Line type="monotone" dataKey="stockKrw" stroke="#2563eb" name="S&P 500 (원화 환산)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="goldKrw" stroke="#eab308" name="금 (원화 환산)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="bond" stroke="#f87171" name="미국 채권 (AGG)" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div style={{ marginTop: '20px', padding: '20px', background: '#082f49', borderRadius: '12px' }}>
                <strong style={{ color: '#7dd3fc', display: 'block', marginBottom: '12px' }}>⚙️ 투자자 프로필</strong>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label>
                        <span style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1' }}>리스크 성향</span>
                        <select value={riskProfile} onChange={(e) => setRiskProfile(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }}>
                            <option value="conservative">보수형</option>
                            <option value="balanced">중립형</option>
                            <option value="aggressive">공격형</option>
                        </select>
                    </label>
                    <label>
                        <span style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1' }}>투자기간 (개월)</span>
                        <input type="number" min="1" max="240" value={investmentHorizonMonths} onChange={(e) => setInvestmentHorizonMonths(Number(e.target.value))} style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }} />
                    </label>
                </div>
                <label style={{ display: 'block', marginTop: '12px' }}>
                    <span style={{ display: 'block', marginBottom: '6px', color: '#cbd5e1' }}>투자자 메모 (선택)</span>
                    <textarea value={investorMemo} onChange={(e) => setInvestorMemo(e.target.value)} rows={3} placeholder="예: 월 적립식, 최대 손실 허용 10%" style={{ width: '100%', padding: '10px', borderRadius: '8px', background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155' }} />
                </label>
            </div>

            <div style={{ marginTop: '20px', padding: '20px', background: '#082f49', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <strong style={{ color: '#7dd3fc' }}>🤖 OpenAI 맞춤 브리핑</strong>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            type="button"
                            onClick={handleAiAnalysis}
                            disabled={isAnalyzing || !latestPoint}
                            style={{
                                border: 'none',
                                background: isAnalyzing ? '#475569' : '#0ea5e9',
                                color: '#f8fafc',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            기본 분석
                        </button>
                        <button
                            type="button"
                            onClick={handleAdvancedBriefing}
                            disabled={isAnalyzing || !latestPoint}
                            style={{
                                border: 'none',
                                background: isAnalyzing ? '#475569' : '#22c55e',
                                color: '#f8fafc',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontWeight: 700,
                                cursor: isAnalyzing ? 'not-allowed' : 'pointer'
                            }}
                        >
                            고급 브리핑
                        </button>
                    </div>
                </div>

                {cacheStatus && (
                    <p style={{ marginTop: '10px', fontSize: '12px', color: cacheStatus.cached ? '#86efac' : '#fbbf24' }}>
                        {cacheStatus.cached ? '✓ 캐시됨' : '⚡ 신규 생성'} · {cacheStatus.timestamp}
                    </p>
                )}

                {analysisError && (
                    <p style={{ marginTop: '12px', color: '#fca5a5' }}>⚠️ {analysisError}</p>
                )}

                {aiAnalysis && (
                    <pre style={{ marginTop: '12px', background: '#0f172a', borderRadius: '8px', padding: '14px', color: '#cbd5e1', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '14px' }}>
                        {aiAnalysis}
                    </pre>
                )}

                {advancedBriefing && (
                    <div style={{ marginTop: '12px', background: '#0f172a', borderRadius: '8px', padding: '14px', color: '#cbd5e1' }}>
                        <h4 style={{ color: '#7dd3fc', marginTop: 0 }}>시장 요약</h4>
                        <p>{advancedBriefing.marketSummary}</p>

                        <h4 style={{ color: '#7dd3fc' }}>투자 플레이북</h4>
                        <ul>{advancedBriefing.investmentPlaybook?.map((item, idx) => <li key={idx}>{item}</li>)}</ul>

                        <h4 style={{ color: '#7dd3fc' }}>리스크 알림</h4>
                        <ul>{advancedBriefing.riskAlerts?.map((item, idx) => <li key={idx}>{item}</li>)}</ul>

                        <h4 style={{ color: '#7dd3fc' }}>추천 자산 배분 (%)</h4>
                        <ul>
                            <li>미국 주식: {advancedBriefing.allocationSuggestion?.usStocksPercent}</li>
                            <li>미국 채권: {advancedBriefing.allocationSuggestion?.usBondsPercent}</li>
                            <li>금: {advancedBriefing.allocationSuggestion?.goldPercent}</li>
                            <li>달러 현금: {advancedBriefing.allocationSuggestion?.usdCashPercent}</li>
                        </ul>

                        <h4 style={{ color: '#7dd3fc' }}>실행 체크리스트</h4>
                        <ul>{advancedBriefing.actionChecklist?.map((item, idx) => <li key={idx}>{item}</li>)}</ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UltimateEconomySim;
