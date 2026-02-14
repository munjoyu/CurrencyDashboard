import React, { useState, useMemo, useEffect } from 'react';
import {
    Globe,
    TrendingUp,
    DollarSign,
    ShieldCheck,
    Activity,
    ArrowRightLeft,
    Banknote,
    Building2,
    Landmark,
    Ship,
    Wallet
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';

// --- Data & Constants ---
const GLOBAL_RESERVES = [
    { name: 'USD', value: 59.0, color: '#3b82f6' },
    { name: 'EUR', value: 19.8, color: '#10b981' },
    { name: 'JPY', value: 5.5, color: '#f59e0b' },
    { name: 'GBP', value: 4.9, color: '#8b5cf6' },
    { name: '기타', value: 10.8, color: '#64748b' }
];

const HISTORICAL_DATA = [
    { year: '1995', usd_share: 59, trade_vol: 40 },
    { year: '2000', usd_share: 71, trade_vol: 55 },
    { year: '2005', usd_share: 66, trade_vol: 70 },
    { year: '2010', usd_share: 62, trade_vol: 85 },
    { year: '2015', usd_share: 65, trade_vol: 100 },
    { year: '2020', usd_share: 59, trade_vol: 110 },
    { year: '2024', usd_share: 58, trade_vol: 125 },
];

// 환율 데이터 (원/달러)
const EXCHANGE_RATE_DATA = [
    { year: '2015', rate: 1131 },
    { year: '2016', rate: 1160 },
    { year: '2017', rate: 1071 },
    { year: '2018', rate: 1100 },
    { year: '2019', rate: 1166 },
    { year: '2020', rate: 1180 },
    { year: '2021', rate: 1144 },
    { year: '2022', rate: 1292 },
    { year: '2023', rate: 1305 },
    { year: '2024', rate: 1380 },
];

// --- Components ---

const MetricCard = ({ title, value, subtext, icon: Icon, trend }) => (
    <div className="bg-slate-800/50 backdrop-blur-sm p-6 rounded-xl border border-slate-700 hover:border-blue-500/50 transition-all duration-300">
        <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-blue-500/10 rounded-lg">
                <Icon className="w-6 h-6 text-blue-400" />
            </div>
            {trend !== undefined && (
                <span className={`text-xs px-2 py-1 rounded-full ${trend > 0 ? 'bg-green-500/20 text-green-400' : trend < 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-500/20 text-slate-400'}`}>
                    {trend > 0 ? '+' : ''}{trend}%
                </span>
            )}
        </div>
        <h3 className="text-slate-400 text-sm font-medium mb-1">{title}</h3>
        <div className="text-2xl font-bold text-white mb-1">{value}</div>
        <p className="text-slate-500 text-xs">{subtext}</p>
    </div>
);

const SectionHeader = ({ title, subtitle }) => (
    <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
        <p className="text-slate-400 max-w-2xl">{subtitle}</p>
    </div>
);

// 탭 버튼 컴포넌트
const TabButton = ({ active, icon: Icon, label, sublabel, onClick }) => (
    <button
        onClick={onClick}
        className={`flex-1 p-4 rounded-lg border transition-all duration-300 ${active
            ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
            : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
            }`}
    >
        <div className="flex items-center justify-center gap-2 mb-1">
            <Icon className="w-5 h-5" />
            <span className="font-semibold">{label}</span>
        </div>
        <span className="text-xs opacity-70">{sublabel}</span>
    </button>
);

// Fed 기준금리 슬라이더
const FedRateSlider = ({ rate, setRate }) => {
    const getRateLabel = (r) => {
        if (r <= 1.5) return { text: '완화적', color: 'text-green-400' };
        if (r <= 3.5) return { text: '중립', color: 'text-yellow-400' };
        return { text: '긴축적', color: 'text-red-400' };
    };

    const label = getRateLabel(rate);

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 mb-6">
            <div className="flex items-center gap-3 mb-4">
                <Landmark className="w-6 h-6 text-amber-500" />
                <div>
                    <h3 className="text-amber-400 font-semibold">미국 연방준비제도(Fed) 기준금리</h3>
                    <p className="text-slate-400 text-sm">금리를 조절하여 자금 흐름의 변화를 관찰하세요</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="flex-1">
                    <div className="flex justify-between text-xs text-slate-500 mb-2">
                        <span>완화적 (0.5%)</span>
                        <span>중립 (3%)</span>
                        <span>긴축적 (6%)</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="6"
                        step="0.25"
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>
                <div className="text-right min-w-[100px]">
                    <div className="flex items-center gap-2 justify-end">
                        <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
                        <span className="text-3xl font-bold text-white">{rate.toFixed(2)}%</span>
                    </div>
                    <span className={`text-sm ${label.color}`}>{label.text}</span>
                </div>
            </div>
        </div>
    );
};

// 국가별 외환보유고 시각화
const CountryReserves = ({ fedRate }) => {
    // Fed 금리에 따라 환율 변동 시뮬레이션
    const baseKRW = 1340;
    const baseCNY = 7.25;

    const krwRate = useMemo(() => {
        const adjustment = (fedRate - 3) * 30; // 금리 1% 변동 시 30원 변동
        return Math.round(baseKRW + adjustment);
    }, [fedRate]);

    const cnyRate = useMemo(() => {
        const adjustment = (fedRate - 3) * 0.1;
        return (baseCNY + adjustment).toFixed(2);
    }, [fedRate]);

    const countries = [
        {
            code: 'KR',
            name: '한국',
            color: '#3b82f6',
            rate: `₩${krwRate.toLocaleString()}/$`,
            reserves: '$420B',
            reserveValue: 420
        },
        {
            code: 'US',
            name: '미국',
            color: '#10b981',
            rate: '기축통화국',
            subRate: `금리 ${fedRate.toFixed(2)}%`,
            reserves: '-',
            reserveValue: 0,
            isAnchor: true
        },
        {
            code: 'CN',
            name: '중국',
            color: '#ef4444',
            rate: `¥${cnyRate}/$`,
            reserves: '$3.2T',
            reserveValue: 3200
        }
    ];

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">외환보유고 구조</h3>
            </div>

            <div className="flex justify-center items-end gap-8 mb-6 py-8">
                {countries.map((country, idx) => (
                    <div key={country.code} className="flex flex-col items-center">
                        {/* 국가 배지 */}
                        <div
                            className={`relative rounded-lg px-4 py-3 mb-2 ${country.isAnchor ? 'scale-110' : ''}`}
                            style={{ backgroundColor: country.color }}
                        >
                            <div className="text-white font-bold text-sm">{country.code} {country.name}</div>
                            <div className="text-white/80 text-xs">{country.rate}</div>
                            {country.subRate && (
                                <div className="text-white/60 text-xs">{country.subRate}</div>
                            )}
                        </div>

                        {/* 보유고 막대 */}
                        {!country.isAnchor && (
                            <div
                                className="w-16 rounded-t-lg transition-all duration-500"
                                style={{
                                    backgroundColor: country.color,
                                    height: `${country.reserveValue / 40}px`,
                                    opacity: 0.6
                                }}
                            />
                        )}
                    </div>
                ))}
            </div>

            <div className="text-center text-sm text-slate-400 border-t border-slate-700 pt-4">
                <Banknote className="w-4 h-4 inline mr-2 text-amber-500" />
                각국 중앙은행은 달러를 외환보유고로 보유합니다
                <div className="text-xs text-slate-500 mt-1">
                    한국: $420B / 중국: $3.2T
                </div>
            </div>
        </div>
    );
};

// 탭 콘텐츠 컴포넌트들
const CapitalFlowContent = ({ fedRate }) => {
    const flowIntensity = fedRate > 3 ? '유입' : '유출';
    const flowColor = fedRate > 3 ? 'text-green-400' : 'text-red-400';

    return (
        <div className="space-y-4">
            <div className="bg-slate-900/50 p-4 rounded-lg">
                <h4 className="text-white font-semibold mb-2">자본 흐름 방향</h4>
                <p className="text-slate-400 text-sm mb-3">
                    Fed 금리가 {fedRate.toFixed(2)}%일 때, 글로벌 자본은 미국으로
                    <span className={`font-bold ${flowColor}`}> {flowIntensity}</span>됩니다.
                </p>
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${fedRate > 3 ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.abs((fedRate - 3) / 3 * 100)}%` }}
                        />
                    </div>
                    <span className="text-slate-400 text-sm">{Math.abs((fedRate - 3) * 33).toFixed(0)}%</span>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-400">$2.1T</div>
                    <div className="text-slate-400 text-sm">일일 달러 거래량</div>
                </div>
                <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-400">89%</div>
                    <div className="text-slate-400 text-sm">FX 거래 USD 비중</div>
                </div>
            </div>
        </div>
    );
};

const TradeSettlementContent = () => (
    <div className="space-y-4">
        <div className="bg-slate-900/50 p-4 rounded-lg">
            <h4 className="text-white font-semibold mb-2">달러 결제 시스템</h4>
            <p className="text-slate-400 text-sm">
                전 세계 무역의 대부분은 미국이 거래 당사자가 아니더라도 달러로 결제됩니다.
            </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-amber-400">74%</div>
                <div className="text-slate-400 text-sm">아시아 수출 달러 결제</div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-purple-400">80%</div>
                <div className="text-slate-400 text-sm">무역금융 달러 비중</div>
            </div>
        </div>
        <div className="flex items-center justify-center gap-4 py-4">
            <div className="px-3 py-2 bg-blue-500/20 rounded-lg text-blue-400 text-sm">한국 수출기업</div>
            <ArrowRightLeft className="w-5 h-5 text-slate-500" />
            <div className="px-3 py-2 bg-green-500/20 rounded-lg text-green-400 text-sm">$ 달러 결제</div>
            <ArrowRightLeft className="w-5 h-5 text-slate-500" />
            <div className="px-3 py-2 bg-red-500/20 rounded-lg text-red-400 text-sm">베트남 수입업체</div>
        </div>
    </div>
);

const ValueStorageContent = () => (
    <div className="space-y-4">
        <div className="bg-slate-900/50 p-4 rounded-lg">
            <h4 className="text-white font-semibold mb-2">가치 저장 수단</h4>
            <p className="text-slate-400 text-sm">
                달러는 세계 각국 중앙은행의 주요 외환보유고로서 가치 저장 기능을 수행합니다.
            </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-slate-900/50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-blue-400">59%</div>
                <div className="text-slate-400 text-xs">글로벌 보유고</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-green-400">$12.8T</div>
                <div className="text-slate-400 text-xs">총 달러 보유고</div>
            </div>
            <div className="bg-slate-900/50 p-3 rounded-lg text-center">
                <div className="text-xl font-bold text-amber-400">190+</div>
                <div className="text-slate-400 text-xs">보유 국가 수</div>
            </div>
        </div>
    </div>
);

// 환율 변화 추이 차트
// 환율 변화 추이 차트 (실시간)
// 기간별 더미 데이터 생성기
const generateData = (period, currentRate) => {
    const data = [];
    let points = 0;
    let volatility = 0;
    let labelFormat = '';

    switch (period) {
        case '1D':
            points = 24; // 시간별
            volatility = 2;
            labelFormat = 'time';
            break;
        case '1M':
            points = 30; // 일별
            volatility = 15;
            labelFormat = 'day';
            break;
        case '1Y':
            points = 12; // 월별
            volatility = 50;
            labelFormat = 'month';
            break;
        case '5Y':
            points = 60; // 월별
            volatility = 150;
            labelFormat = 'year';
            break;
        case 'Max':
            points = 100;
            volatility = 300;
            labelFormat = 'year';
            break;
        default:
            points = 30;
            volatility = 10;
    }

    let rate = currentRate;
    const now = new Date();

    for (let i = points; i >= 0; i--) {
        // 랜덤 워크 시뮬레이션
        const change = (Math.random() - 0.5) * volatility;
        rate += change;

        // 날짜 라벨 생성
        let label = '';
        const d = new Date(now);

        if (period === '1D') {
            d.setHours(d.getHours() - i);
            label = `${d.getHours()}:00`;
        } else if (period === '1M') {
            d.setDate(d.getDate() - i);
            label = `${d.getMonth() + 1}/${d.getDate()}`;
        } else if (period === '1Y') {
            d.setMonth(d.getMonth() - i);
            label = `${d.getFullYear()}.${d.getMonth() + 1}`;
        } else {
            d.setMonth(d.getMonth() - i);
            label = `${d.getFullYear()}`;
        }

        data.push({
            date: label,
            rate: Number(rate.toFixed(2))
        });
    }
    return data;
};

// 환율 변화 추이 차트 및 계산기
const ExchangeRateChart = ({ fedRate }) => {
    const [period, setPeriod] = useState('1Y');
    const [usdAmount, setUsdAmount] = useState(1);
    const [krwAmount, setKrwAmount] = useState(1380);
    const [chartData, setChartData] = useState([]);
    const [currentRate, setCurrentRate] = useState(1380);

    // Fed 금리 변경 시 기준 환율 업데이트
    useEffect(() => {
        const baseRate = 1340 + (fedRate - 3) * 30;
        setCurrentRate(baseRate);
        setKrwAmount(Math.round(usdAmount * baseRate));
    }, [fedRate]);

    // 기간 변경 시 데이터 재생성
    useEffect(() => {
        const newData = generateData(period, currentRate);
        setChartData(newData);
    }, [period, currentRate]);

    // 환율 계산 핸들러
    const handleUsdChange = (e) => {
        const val = e.target.value;
        setUsdAmount(val);
        setKrwAmount(Math.round(val * currentRate));
    };

    const handleKrwChange = (e) => {
        const val = e.target.value;
        setKrwAmount(val);
        setUsdAmount((val / currentRate).toFixed(2));
    };

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            {/* 상단 헤더 & 환율 계산기 */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-6 h-6 text-green-400" />
                    <div>
                        <h3 className="text-xl font-bold text-white">USD/KRW 환율</h3>
                        <p className="text-sm text-slate-400">실시간 환율 변동 및 계산</p>
                    </div>
                </div>

                {/* 환율 계산기 UI */}
                <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-lg border border-slate-700">
                    <div className="relative group">
                        <label className="absolute -top-2 left-2 text-[10px] text-slate-400 bg-slate-900 px-1 group-focus-within:text-blue-400">USD</label>
                        <input
                            type="number"
                            value={usdAmount}
                            onChange={handleUsdChange}
                            className="w-24 bg-transparent border border-slate-600 rounded px-3 py-1.5 text-right text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                    <ArrowRightLeft className="w-4 h-4 text-slate-500" />
                    <div className="relative group">
                        <label className="absolute -top-2 left-2 text-[10px] text-slate-400 bg-slate-900 px-1 group-focus-within:text-blue-400">KRW</label>
                        <input
                            type="number"
                            value={krwAmount}
                            onChange={handleKrwChange}
                            className="w-32 bg-transparent border border-slate-600 rounded px-3 py-1.5 text-right text-white focus:outline-none focus:border-blue-500 transition-colors"
                        />
                    </div>
                </div>
            </div>

            {/* 메인 차트 영역 */}
            <div className="mb-4">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <span className="text-3xl font-bold text-white">
                            {Number(currentRate).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </span>
                        <span className="text-sm text-slate-400 ml-2">KRW</span>
                        <div className={`text-sm ${currentRate >= 1340 ? 'text-green-400' : 'text-red-400'} flex items-center gap-1 mt-1`}>
                            {currentRate >= 1340 ? '+' : ''}{(currentRate - 1340).toFixed(1)} ({((currentRate - 1340) / 1340 * 100).toFixed(2)}%)
                            <span className="text-slate-500 text-xs ml-1">vs 전일</span>
                        </div>
                    </div>

                    {/* 기간 선택 탭 */}
                    <div className="flex bg-slate-700/50 p-1 rounded-lg">
                        {['1D', '1M', '1Y', '5Y', 'Max'].map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${period === p
                                        ? 'bg-slate-600 text-white shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                                    }`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="date"
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                domain={['auto', 'auto']}
                                stroke="#64748b"
                                tick={{ fill: '#64748b', fontSize: 11 }}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                                formatter={(value) => [`₩${value.toLocaleString()}`, '환율']}
                                labelStyle={{ color: '#94a3b8' }}
                            />
                            <Area
                                type="monotone"
                                dataKey="rate"
                                stroke="#10b981"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorRate)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// 시뮬레이션 패널 (Fed 금리와 연동)
const SimulationPanel = ({ fedRate }) => {
    // Fed 금리 기반으로 파생 값 계산
    const trustLevel = useMemo(() => {
        // 금리가 높을수록 달러 신뢰도 상승 (단기적)
        return Math.min(100, Math.max(20, 50 + (fedRate - 3) * 15));
    }, [fedRate]);

    const stabilityIndex = (trustLevel * 0.8 + 20).toFixed(1);
    const spread = ((100 - trustLevel) * 0.15).toFixed(2);

    return (
        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-400" />
                시장 영향 시뮬레이터
            </h3>

            <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-300">달러 신뢰도 (Fed 금리 연동)</span>
                    <span className="text-blue-400 font-bold">{trustLevel.toFixed(0)}%</span>
                </div>
                <div className="w-full h-2 bg-slate-700 rounded-lg overflow-hidden">
                    <div
                        className="h-full bg-blue-500 transition-all duration-500"
                        style={{ width: `${trustLevel}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                    <div className="text-sm text-slate-400 mb-1">안정성 지수</div>
                    <div className={`text-xl font-bold ${trustLevel > 50 ? 'text-green-400' : 'text-red-400'}`}>
                        {stabilityIndex}
                    </div>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-lg text-center">
                    <div className="text-sm text-slate-400 mb-1">은행간 스프레드</div>
                    <div className="text-xl font-bold text-blue-400">{spread}%</div>
                </div>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="text-sm text-blue-300">
                    <strong>인사이트:</strong> Fed 금리 {fedRate.toFixed(2)}%에서 {trustLevel > 50 ? '글로벌 자본이 미국으로 유입되어 달러 가치가 상승합니다.' : '상대적으로 낮은 금리로 자본 유출 압력이 발생합니다.'}
                </div>
            </div>
        </div>
    );
};

// 메인 대시보드 컴포넌트
const AnchorCurrencyDashboard = () => {
    const [fedRate, setFedRate] = useState(5.33);
    const [activeTab, setActiveTab] = useState('storage'); // 'flow', 'trade', 'storage'

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans selection:bg-blue-500/30">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <header className="mb-8 border-b border-slate-800 pb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Globe className="w-8 h-8 text-amber-500 animate-pulse" />
                        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-yellow-200">
                            기축통화(Anchor Currency) 작동 원리
                        </h1>
                    </div>
                    <p className="text-slate-400 text-lg">
                        미국 달러가 세계 경제에 미치는 영향을 실시간으로 체험해보세요
                    </p>
                </header>

                {/* Fed Rate Slider */}
                <FedRateSlider rate={fedRate} setRate={setFedRate} />

                {/* Tab System */}
                <div className="flex gap-4 mb-8">
                    <TabButton
                        active={activeTab === 'flow'}
                        icon={TrendingUp}
                        label="자금 흐름"
                        sublabel="실시간 자본 이동"
                        onClick={() => setActiveTab('flow')}
                    />
                    <TabButton
                        active={activeTab === 'trade'}
                        icon={Ship}
                        label="무역 결제"
                        sublabel="달러 결제 시스템"
                        onClick={() => setActiveTab('trade')}
                    />
                    <TabButton
                        active={activeTab === 'storage'}
                        icon={Wallet}
                        label="가치 저장"
                        sublabel="외환보유고"
                        onClick={() => setActiveTab('storage')}
                    />
                </div>

                {/* Top Metrics Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <MetricCard
                        title="글로벌 외환보유고 점유율"
                        value="59.0%"
                        subtext="각국 중앙은행의 달러 비중"
                        icon={Banknote}
                        trend={-0.5}
                    />
                    <MetricCard
                        title="무역 결제 비중"
                        value="74.0%"
                        subtext="아시아-태평양 수출 달러 결제"
                        icon={ArrowRightLeft}
                        trend={1.2}
                    />
                    <MetricCard
                        title="외환 거래 비중"
                        value="89.0%"
                        subtext="모든 FX 거래의 한쪽은 달러"
                        icon={TrendingUp}
                        trend={0.1}
                    />
                    <MetricCard
                        title="Fed 기준금리"
                        value={`${fedRate.toFixed(2)}%`}
                        subtext="기축통화 기준 금리"
                        icon={DollarSign}
                        trend={0}
                    />
                </div>

                {/* Tab Content + Country Reserves */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                    <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                        {activeTab === 'flow' && <CapitalFlowContent fedRate={fedRate} />}
                        {activeTab === 'trade' && <TradeSettlementContent />}
                        {activeTab === 'storage' && <ValueStorageContent />}
                    </div>
                    <CountryReserves fedRate={fedRate} />
                </div>

                {/* Exchange Rate Chart */}
                <div className="mb-8">
                    <ExchangeRateChart fedRate={fedRate} />
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">

                    {/* Left Column: Charts & Triffin */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* Historical Trend Chart */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-white">역사적 달러 지배력 추이</h3>
                                <div className="flex gap-4">
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <div className="w-3 h-3 bg-blue-500 rounded-full"></div> USD 점유율
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-slate-400">
                                        <div className="w-3 h-3 bg-emerald-500 rounded-full"></div> 무역량
                                    </div>
                                </div>
                            </div>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={HISTORICAL_DATA}>
                                        <defs>
                                            <linearGradient id="colorUsd" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorTrade" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                        <XAxis dataKey="year" stroke="#64748b" tick={{ fill: '#64748b' }} />
                                        <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                                            itemStyle={{ color: '#f1f5f9' }}
                                        />
                                        <Area type="monotone" dataKey="usd_share" name="USD 점유율" stroke="#3b82f6" fillOpacity={1} fill="url(#colorUsd)" />
                                        <Area type="monotone" dataKey="trade_vol" name="무역량 지수" stroke="#10b981" fillOpacity={1} fill="url(#colorTrade)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Triffin Dilemma */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-3 opacity-10">
                                <ShieldCheck size={120} />
                            </div>
                            <h3 className="text-lg font-semibold text-white mb-4">메커니즘: 트리핀 딜레마</h3>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <p className="text-slate-400 text-sm leading-relaxed">
                                        기축통화국(미국)은 세계에 달러 유동성을 공급하기 위해 무역 적자를 감수해야 합니다.
                                        그러나 지속적인 적자는 장기적으로 통화 신뢰도를 약화시킵니다.
                                    </p>
                                    <ul className="space-y-2 text-sm text-slate-300">
                                        <li className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                            글로벌 유동성 공급 필요
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                            신뢰도 침식 위험
                                        </li>
                                    </ul>
                                </div>
                                <div className="flex items-center justify-center p-4 bg-slate-900/50 rounded-lg border border-slate-700/50">
                                    <div className="relative w-full h-[150px] flex items-center justify-center">
                                        <div className="absolute w-[180px] h-[180px] border-2 border-dashed border-slate-600 rounded-full animate-[spin_10s_linear_infinite]"></div>
                                        <div className="z-10 bg-blue-600 text-white rounded-full w-24 h-24 flex items-center justify-center font-bold shadow-lg shadow-blue-500/20">
                                            기축통화
                                        </div>
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-700 text-xs px-2 py-1 rounded">유동성</div>
                                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-700 text-xs px-2 py-1 rounded">적자</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Right Column: Pie Chart & Simulator */}
                    <div className="space-y-8">

                        {/* Reserves Pie Chart */}
                        <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700">
                            <h3 className="text-lg font-semibold text-white mb-6">글로벌 외환보유고 구성</h3>
                            <div className="h-[250px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={GLOBAL_RESERVES}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="value"
                                        >
                                            {GLOBAL_RESERVES.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0)" />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9' }}
                                            formatter={(value) => [`${value}%`, '점유율']}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <div className="text-sm text-slate-400">USD</div>
                                    <div className="text-xl font-bold text-white">59%</div>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                                {GLOBAL_RESERVES.map(item => (
                                    <div key={item.name} className="flex items-center gap-1.5">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                        <span className="text-slate-300">{item.name}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Simulation Panel */}
                        <SimulationPanel fedRate={fedRate} />

                        <div className="bg-gradient-to-r from-blue-600/20 to-indigo-600/20 p-6 rounded-xl border border-blue-500/20">
                            <h4 className="font-semibold text-blue-300 mb-2">알고 계셨나요?</h4>
                            <p className="text-sm text-slate-400">
                                미국이 거래 당사자가 아닌 경우에도 전 세계 무역 금융의 80% 이상이
                                미국 달러로 이루어집니다.
                            </p>
                        </div>

                    </div>

                </div>

                {/* Footer */}
                <footer className="border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
                    <p>© 2024 기축통화 대시보드. 교육 목적으로 제작되었습니다.</p>
                </footer>

            </div>
        </div>
    );
};

export default AnchorCurrencyDashboard;
