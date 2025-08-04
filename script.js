document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tickerInput = document.getElementById('tickerInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const stockInfoElement = document.getElementById('stockInfo');
    const recentTickersElement = document.getElementById('recentTickers');
    const datetimeElement = document.getElementById('datetime');

    // API Configuration
    const API_KEY = 'd2837khr01qr2iauetf0d2837khr01qr2iauetfg';
    const API_BASE_URL = 'https://finnhub.io/api/v1';
    
    // Chart instance
    let stockChart;
    let chartTimeframe = 'D'; // Daily by default
    let currentTicker = 'AAPL';

    // Initialize
    updateDateTime();
    setInterval(updateDateTime, 1000);
    fetchStockData('AAPL');

    // Event Listeners
    searchBtn.addEventListener('click', () => fetchStockData(tickerInput.value.trim()));
    tickerInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') fetchStockData(tickerInput.value.trim());
    });

    // Main Stock Data Fetch Function
    async function fetchStockData(ticker) {
        ticker = ticker.toUpperCase();
        currentTicker = ticker;
        tickerInput.value = ticker;

        if (!ticker) {
            showError("Please enter a ticker symbol");
            return;
        }

        // UI State Management
        loadingElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        stockInfoElement.classList.add('hidden');
        document.getElementById('stockChartContainer').classList.add('hidden');
        document.getElementById('newsContainer').classList.add('hidden');

        try {
            // Fetch all data in parallel
            const [quoteData, profileData] = await Promise.all([
                fetchWithFallback(`quote?symbol=${ticker}`),
                fetchWithFallback(`stock/profile2?symbol=${ticker}`)
            ]);

            // Validate data
            if (!quoteData || !quoteData.c) throw new Error("No price data available");
            if (!profileData) throw new Error("No company data available");

            // Update UI
            updateStockInfo({
                ticker,
                companyName: profileData.name || ticker,
                price: quoteData.c,
                change: quoteData.d,
                changePercent: quoteData.dp,
                prevClose: quoteData.pc,
                open: quoteData.o,
                high: quoteData.h,
                low: quoteData.l,
                marketCap: profileData.marketCapitalization ? 
                    formatMarketCap(profileData.marketCapitalization) : '-'
            });

            // Load additional data
            await Promise.all([
                renderStockChart(ticker),
                fetchNews(ticker)
            ]);

            // Update recent tickers
            updateRecentTickers(ticker);

            // Show content
            loadingElement.classList.add('hidden');
            stockInfoElement.classList.remove('hidden');
        } catch (error) {
            console.error('Fetch error:', error);
            showError("Failed to fetch data. Please check the ticker and try again.");
            loadingElement.classList.add('hidden');
            errorElement.classList.remove('hidden');
        }
    }

    // Improved fetch with retry logic
    async function fetchWithFallback(endpoint) {
        try {
            // Try direct API call first
            return await fetchAPI(endpoint);
        } catch (error) {
            console.log("Direct API failed, trying CORS proxy...");
            try {
                // Try with CORS proxy
                return await fetchAPI(endpoint, true);
            } catch (proxyError) {
                console.error("Proxy also failed:", proxyError);
                throw error; // Throw original error
            }
        }
    }

    // Core API fetch function
    async function fetchAPI(endpoint, useProxy = false) {
        const url = useProxy 
            ? `https://cors-anywhere.herokuapp.com/${API_BASE_URL}/${endpoint}&token=${API_KEY}`
            : `${API_BASE_URL}/${endpoint}&token=${API_KEY}`;

        const response = await fetch(url, {
            headers: useProxy ? {
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': window.location.origin
            } : {}
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        
        // Finnhub returns { error: "Message" } for invalid requests
        if (data.error) {
            throw new Error(data.error);
        }

        return data;
    }

    // Chart Rendering
    async function renderStockChart(ticker) {
        try {
            const data = await fetchWithFallback(
                `stock/candle?symbol=${ticker}&resolution=${chartTimeframe}&count=30`
            );

            const ctx = document.getElementById('stockChart').getContext('2d');
            if (stockChart) stockChart.destroy();

            // Create gradient
            const gradient = ctx.createLinearGradient(0, 0, 0, 400);
            gradient.addColorStop(0, 'rgba(0, 255, 252, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 255, 252, 0)');

            stockChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.t.map(t => new Date(t * 1000).toLocaleDateString()),
                    datasets: [{
                        label: 'Price',
                        data: data.c,
                        borderColor: 'var(--neon-blue)',
                        backgroundColor: gradient,
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => `$${context.parsed.y.toFixed(2)}`
                            }
                        }
                    },
                    scales: {
                        x: { grid: { color: 'rgba(255, 255, 255, 0.1)' } },
                        y: { 
                            grid: { color: 'rgba(255, 255, 255, 0.1)' },
                            ticks: { callback: (value) => `$${value}` }
                        }
                    }
                }
            });

            // Add timeframe controls
            createChartControls();
            document.getElementById('stockChartContainer').classList.remove('hidden');
        } catch (error) {
            console.error('Chart error:', error);
        }
    }

    // Chart Timeframe Controls
    function createChartControls() {
        const container = document.getElementById('chartControls') || document.createElement('div');
        container.id = 'chartControls';
        container.className = 'chart-controls';
        container.innerHTML = '';

        const timeframes = [
            { label: '1D', value: '1' },
            { label: '1W', value: 'D' },
            { label: '1M', value: 'W' },
            { label: '1Y', value: 'M' }
        ];

        timeframes.forEach(tf => {
            const btn = document.createElement('button');
            btn.textContent = tf.label;
            btn.className = chartTimeframe === tf.value ? 'active' : '';
            btn.onclick = () => {
                chartTimeframe = tf.value;
                renderStockChart(currentTicker);
            };
            container.appendChild(btn);
        });

        if (!document.getElementById('chartControls')) {
            document.getElementById('stockChartContainer').prepend(container);
        }
    }

    // News Fetching
    async function fetchNews(ticker) {
        try {
            const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];
            
            const news = await fetchWithFallback(
                `company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}`
            );

            const newsFeed = document.getElementById('newsFeed');
            newsFeed.innerHTML = '';

            news.slice(0, 5).forEach(item => {
                if (item.headline && item.url) {
                    const newsItem = document.createElement('div');
                    newsItem.className = 'news-item';
                    newsItem.innerHTML = `
                        <h3>${item.headline}</h3>
                        <p>${item.summary || 'No summary available'}</p>
                        <a href="${item.url}" target="_blank">Read more →</a>
                    `;
                    newsFeed.appendChild(newsItem);
                }
            });

            document.getElementById('newsContainer').classList.remove('hidden');
        } catch (error) {
            console.error('News fetch error:', error);
        }
    }

    // Recent Tickers Management
    function updateRecentTickers(ticker) {
        let recentTickers = JSON.parse(localStorage.getItem('recentTickers')) || [];
        
        if (!recentTickers.includes(ticker)) {
            recentTickers.unshift(ticker);
            if (recentTickers.length > 5) recentTickers.pop();
            localStorage.setItem('recentTickers', JSON.stringify(recentTickers));
            updateRecentTickersDisplay();
        }
    }

    function updateRecentTickersDisplay() {
        const recentTickers = JSON.parse(localStorage.getItem('recentTickers')) || [];
        recentTickersElement.innerHTML = '';

        recentTickers.forEach(ticker => {
            const element = document.createElement('div');
            element.className = 'recent-ticker';
            element.textContent = ticker;
            element.onclick = () => fetchStockData(ticker);
            recentTickersElement.appendChild(element);
        });
    }

    // UI Update Functions
    function updateStockInfo(data) {
        document.getElementById('companyName').textContent = data.companyName;
        document.getElementById('symbol').textContent = data.ticker;
        
        const priceElement = document.getElementById('price');
        priceElement.textContent = `$${data.price.toFixed(2)}`;
        priceElement.className = 'price';

        const changeElement = document.getElementById('change');
        const changePercentElement = document.getElementById('changePercent');

        if (data.change >= 0) {
            changeElement.textContent = `+$${data.change.toFixed(2)}`;
            changeElement.className = 'positive';
            changePercentElement.textContent = `+${data.changePercent.toFixed(2)}%`;
            changePercentElement.className = 'positive';
        } else {
            changeElement.textContent = `-$${Math.abs(data.change).toFixed(2)}`;
            changeElement.className = 'negative';
            changePercentElement.textContent = `${data.changePercent.toFixed(2)}%`;
            changePercentElement.className = 'negative';
        }

        document.getElementById('prevClose').textContent = `$${data.prevClose.toFixed(2)}`;
        document.getElementById('open').textContent = `$${data.open.toFixed(2)}`;
        document.getElementById('dayRange').textContent = 
            `$${data.low.toFixed(2)} - $${data.high.toFixed(2)}`;
        document.getElementById('marketCap').textContent = data.marketCap;
    }

    function showError(message) {
        errorElement.innerHTML = `
            <p>ERROR: ${message}</p>
            <p>PLEASE VERIFY TICKER SYMBOL AND TRY AGAIN</p>
        `;
        errorElement.classList.remove('hidden');
    }

    // Utility Functions
    function updateDateTime() {
        const now = new Date();
        datetimeElement.textContent = now.toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    function formatMarketCap(marketCap) {
        if (marketCap >= 1e12) return `$${(marketCap / 1e12).toFixed(2)}T`;
        if (marketCap >= 1e9) return `$${(marketCap / 1e9).toFixed(2)}B`;
        if (marketCap >= 1e6) return `$${(marketCap / 1e6).toFixed(2)}M`;
        return `$${marketCap.toFixed(2)}`;
    }
});