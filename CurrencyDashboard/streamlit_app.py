import streamlit as st
import requests
import json
from datetime import datetime
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px

# Page config
st.set_page_config(
    page_title="CurrencyDashboard",
    page_icon="💱",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
    <style>
        .main {
            background-color: #0f172a;
            color: #e2e8f0;
        }
        .stTabs [data-baseweb="tab-list"] button {
            font-size: 18px;
            padding: 10px 20px;
        }
        h1, h2, h3 {
            color: #e2e8f0;
        }
        .metric-card {
            background-color: #1e293b;
            padding: 20px;
            border-radius: 10px;
            margin: 10px 0;
        }
    </style>
""", unsafe_allow_html=True)

# Title and description
st.title("💱 CurrencyDashboard")
st.markdown("""
Advanced interactive dashboard for macroeconomic education and investment simulation 
with OpenAI API integration, comprehensive health monitoring, and real-time metrics tracking.
""")

# Sidebar
st.sidebar.title("🔧 Configuration")
api_url = st.sidebar.text_input(
    "API Backend URL",
    value="http://localhost:8787",
    help="Local: http://localhost:8787 | Production: your-backend-url.com"
)

# Tab selection
tab1, tab2, tab3 = st.tabs(["📊 기축통화 교육", "💼 투자 시뮬레이터", "🏥 시스템 상태"])

# ==================== TAB 1: Education ====================
with tab1:
    st.header("기축통화(Anchor Currency) 교육 대시보드")
    st.markdown("""
    기축통화란 국제 거래에서 기준이 되는 통화입니다. 
    주로 미국 달러(USD)가 기축통화의 역할을 하고 있습니다.
    """)
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("기준 금리 (Federal Rate)", "5.25 - 5.50%", delta="-0.25%")
    with col2:
        st.metric("환율 (USD/KRW)", "1,203.50", delta="+0.35")
    with col3:
        st.metric("외환보유고", "$418.6B", delta="+$2.1B")
    
    # Federal Reserve Rate Slider
    st.subheader("💹 Federal Reserve 기준금리 시뮬레이션")
    fed_rate = st.slider(
        "금리 조정 (%)",
        min_value=0.0,
        max_value=10.0,
        value=5.375,
        step=0.125,
        help="Federal Reserve의 기준금리를 조정하여 시장에 미치는 영향을 관찰하세요"
    )
    
    # Chart showing Fed rate impact
    fig = go.Figure()
    
    # Sample data
    economic_data = {
        'Month': pd.date_range('2024-01-01', periods=12, freq='M'),
        'GDP Growth': [2.5, 2.3, 2.1, 2.0, 1.9, 1.8, 1.9, 2.1, 2.3, 2.5, 2.6, 2.7],
        'Inflation Rate': [3.1, 3.0, 2.9, 2.8, 2.7, 2.6, 2.5, 2.4, 2.3, 2.2, 2.1, 2.0],
        'Unemployment': [3.9, 3.8, 3.7, 3.8, 3.9, 4.0, 4.1, 4.0, 3.9, 3.8, 3.7, 3.6]
    }
    df_econ = pd.DataFrame(economic_data)
    
    fig.add_trace(go.Scatter(
        x=df_econ['Month'], y=df_econ['GDP Growth'],
        mode='lines+markers', name='GDP Growth (%)',
        line=dict(color='#10b981', width=3)
    ))
    fig.add_trace(go.Scatter(
        x=df_econ['Month'], y=df_econ['Inflation Rate'],
        mode='lines+markers', name='Inflation Rate (%)',
        line=dict(color='#f59e0b', width=3)
    ))
    
    fig.update_layout(
        title="경제 지표 추이 (2024)",
        xaxis_title="월",
        yaxis_title="백분율 (%)",
        hovermode='x unified',
        template='plotly_dark',
        height=400
    )
    st.plotly_chart(fig, use_container_width=True)
    
    # Currency Reserves Data
    st.subheader("🏦 주요국 외환보유고")
    
    reserves_data = {
        '국가': ['China', 'Japan', 'Germany', 'South Korea', 'Saudi Arabia', 'Switzerland'],
        '외환보유고 ($B)': [3211.6, 1294.5, 276.0, 418.6, 727.6, 896.2],
        '전월 대비 변화 ($B)': [+45.2, +12.3, +8.5, +2.1, -5.3, +6.1]
    }
    df_reserves = pd.DataFrame(reserves_data)
    
    fig_reserves = px.bar(
        df_reserves,
        x='국가',
        y='외환보유고 ($B)',
        title='주요국 외환보유고 현황',
        color='외환보유고 ($B)',
        color_continuous_scale='Viridis',
        labels={'외환보유고 ($B)': '외환보유고 (십억 달러)'}
    )
    fig_reserves.update_layout(template='plotly_dark', height=400)
    st.plotly_chart(fig_reserves, use_container_width=True)

# ==================== TAB 2: Investment Simulator ====================
with tab2:
    st.header("💼 투자 시뮬레이터")
    st.markdown("OpenAI를 활용한 실시간 시장 분석 및 투자 조언")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.metric("포트폴리오", "$50,000", delta="+$2,345 (+4.9%)")
    with col2:
        st.metric("수익률", "+12.5%", delta="+0.8%")
    
    # Investment Input
    st.subheader("📈 포트폴리오 분석 요청")
    
    market_input = st.text_area(
        "시장 현황 입력",
        value="NASDAQ up 2.3%, Fed rate at 5.25%, USD strong",
        placeholder="시장 상황을 설명하고 AI 분석을 받으세요",
        height=100
    )
    
    if st.button("🤖 AI 분석 요청", key="analyze_btn"):
        with st.spinner("OpenAI 분석 중..."):
            try:
                response = requests.post(
                    f"{api_url}/api/analysis",
                    json={
                        "market_data": market_input,
                        "user_id": "streamlit_user"
                    },
                    timeout=30
                )
                
                if response.status_code == 200:
                    data = response.json()
                    st.success("✅ 분석 완료!")
                    
                    col1, col2 = st.columns([3, 1])
                    with col1:
                        st.markdown("### 📊 AI 분석 결과")
                        st.write(data.get('analysis', 'No analysis available'))
                    with col2:
                        st.metric(
                            "캐시됨",
                            "예" if data.get('from_cache') else "아니오"
                        )
                else:
                    st.error(f"❌ API 오류: {response.status_code}")
                    st.write(response.text)
            except Exception as e:
                st.error(f"❌ 연결 실패: {str(e)}")
                st.info("💡 팁: 로컬 개발 환경에서는 `npm run dev`로 백엔드를 실행하세요")
    
    # Portfolio allocation pie chart
    st.subheader("📊 포트폴리오 구성")
    
    allocation = {
        '자산': ['미국 주식', '국제 주식', '채권', '현금', '암호화폐'],
        '비율': [45, 20, 20, 10, 5]
    }
    df_allocation = pd.DataFrame(allocation)
    
    fig_pie = px.pie(
        df_allocation,
        values='비율',
        names='자산',
        title='포트폴리오 자산 배분',
        color_discrete_sequence=px.colors.qualitative.Set2
    )
    fig_pie.update_layout(template='plotly_dark', height=400)
    st.plotly_chart(fig_pie, use_container_width=True)

# ==================== TAB 3: System Status ====================
with tab3:
    st.header("🏥 시스템 상태")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("🔄 헬스 체크", key="health_btn"):
            with st.spinner("Backend 확인 중..."):
                try:
                    response = requests.get(f"{api_url}/api/health", timeout=5)
                    
                    if response.status_code in [200, 206]:
                        data = response.json()
                        st.success(f"✅ Status: **{data.get('status', 'unknown').upper()}**")
                        
                        # Components status
                        st.subheader("컴포넌트 상태")
                        components = data.get('components', {})
                        for component, status in components.items():
                            if status == 'operational':
                                st.success(f"✅ {component}: {status}")
                            else:
                                st.warning(f"⚠️ {component}: {status}")
                        
                        # Uptime
                        uptime_sec = data.get('uptime_seconds', 0)
                        uptime_min = uptime_sec // 60
                        uptime_hour = uptime_min // 60
                        st.info(f"⏱️ Uptime: {uptime_hour}h {uptime_min % 60}m {uptime_sec % 60}s")
                        
                    elif response.status_code == 503:
                        st.error("❌ Backend unavailable (503)")
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        
                except requests.exceptions.ConnectionError:
                    st.error("❌ Backend에 연결할 수 없습니다")
                    st.warning("💡 팁: 로컬 개발 환경에서는 터미널에서 `npm run dev` 실행")
                except Exception as e:
                    st.error(f"❌ 오류: {str(e)}")
    
    with col2:
        if st.button("📊 통계 조회", key="stats_btn"):
            with st.spinner("통계 수집 중..."):
                try:
                    response = requests.get(f"{api_url}/api/stats", timeout=5)
                    
                    if response.status_code == 200:
                        stats = response.json()
                        
                        col_a, col_b = st.columns(2)
                        with col_a:
                            st.metric(
                                "총 요청 수",
                                stats.get('requests_total', 0)
                            )
                            st.metric(
                                "5분 요청",
                                stats.get('requests_last_5min', 0)
                            )
                        with col_b:
                            st.metric(
                                "오류율",
                                f"{stats.get('error_rate_percent', 0):.2f}%"
                            )
                            st.metric(
                                "평균 응답시간",
                                f"{stats.get('avg_latency_ms', 0):.0f}ms"
                            )
                        
                        st.metric(
                            "캐시 히트율",
                            f"{stats.get('cache_hit_rate_percent', 0):.1f}%"
                        )
                        
                        # Top endpoints
                        st.subheader("상위 엔드포인트")
                        top_endpoints = stats.get('top_endpoints', [])
                        if top_endpoints:
                            df_endpoints = pd.DataFrame(top_endpoints)
                            st.dataframe(df_endpoints, use_container_width=True)
                    else:
                        st.error(f"❌ Error: {response.status_code}")
                        
                except Exception as e:
                    st.error(f"❌ 오류: {str(e)}")
    
    # API Endpoints documentation
    st.subheader("📡 API 엔드포인트")
    
    endpoints = [
        {
            "Endpoint": "GET /api/health",
            "Description": "전체 헬스 상태 확인",
            "Status Codes": "200/206/503"
        },
        {
            "Endpoint": "GET /api/health/live",
            "Description": "Kubernetes liveness probe",
            "Status Codes": "200/503"
        },
        {
            "Endpoint": "GET /api/health/ready",
            "Description": "Readiness probe",
            "Status Codes": "200/503"
        },
        {
            "Endpoint": "GET /api/stats",
            "Description": "요청 통계 및 메트릭",
            "Status Codes": "200"
        },
        {
            "Endpoint": "POST /api/analysis",
            "Description": "AI 시장 분석 요청",
            "Status Codes": "200/429/500"
        }
    ]
    
    df_endpoints_doc = pd.DataFrame(endpoints)
    st.dataframe(df_endpoints_doc, use_container_width=True, hide_index=True)

# Footer
st.markdown("---")
col1, col2, col3 = st.columns(3)
with col1:
    st.markdown("🔗 [GitHub](https://github.com/STak6334/CurrencyDashboard)")
with col2:
    st.markdown("📖 [Documentation](https://github.com/STak6334/CurrencyDashboard/blob/main/README.md)")
with col3:
    st.markdown("🚀 [Live Demo](http://localhost:5173/CurrencyDashboard)")

st.markdown(f"""
<div style='text-align: center; color: #64748b; margin-top: 20px;'>
    <small>CurrencyDashboard v1.2.3 | Built with Streamlit | {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</small>
</div>
""", unsafe_allow_html=True)
