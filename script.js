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
    
    // Initialize
    updateDateTime();
    setInterval(updateDateTime, 1000);
    tickerInput.value = 'AAPL';
    fetchStockData();

    // Event Listeners
    searchBtn.addEventListener('click', fetchStockData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') fetchStockData();
    });

    // Main Stock Data Fetch Function
    async function fetchStockData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        
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
            // Fetch data using Promise.all for parallel requests
            const [quoteData, profileData] = await Promise.all([
                fetchWithFallback(`quote?symbol=${ticker}`),
                fetchWithFallback(`stock/profile2?symbol=${ticker}`)
            ]);

            // Validate data
            if (!quoteData || typeof quoteData.c !== 'number' || !profileData) {
                throw new Error('Invalid data received from API');
            }

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

            // Load chart and news
            await renderStockChart(ticker);
            await fetchNews(ticker);

            // Update recent tickers
            updateRecentTickers(ticker);
            
            // Show content
            loadingElement.classList.add('hidden');
            stockInfoElement.classList.remove('hidden');
            
        } catch (error) {
            console.error('Fetch error:', error);
            showError("Service temporarily unavailable. Please try again later.");
            loadingElement.classList.add('hidden');
            errorElement.classList.remove('hidden');
        }
    }
    
    // Improved fetch with retry logic
    async function fetchWithFallback(endpoint) {
        const url = `${API_BASE_URL}/${endpoint}&token=${API_KEY}`;
        
        try {
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Check for API-level errors
            if (data.error) {
                throw new Error(data.error);
            }
            
            return data;
        } catch (error) {
            console.warn(`Direct fetch failed (${endpoint}), trying proxy...`, error);
            return fetchViaProxy(endpoint);
        }
    }

    // Proxy fetch function
    async function fetchViaProxy(endpoint) {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(`${API_BASE_URL}/${endpoint}&token=${API_KEY}`)}`;
        
        try {
            const response = await fetch(proxyUrl);
            
            if (!response.ok) {
                throw new Error(`Proxy error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return JSON.parse(data.contents);
        } catch (error) {
            console.error('Proxy fetch failed:', error);
            throw error;
        }
    }

    // Chart Rendering
    async function renderStockChart(ticker) {
        try {
            const data = await fetchWithFallback(`stock/candle?symbol=${ticker}&resolution=D&count=30`);
            
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
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
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
                            ticks: { callback: value => `$${value}` }
                        }
                    }
                }
            });
            
            document.getElementById('stockChartContainer').classList.remove('hidden');
        } catch (error) {
            console.error('Chart error:', error);
        }
    }

    // News Fetching
    async function fetchNews(ticker) {
        try {
            const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];
            
            const news = await fetchWithFallback(`company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}`);
            
            const newsFeed = document.getElementById('newsFeed');
            newsFeed.innerHTML = '';
            
            // Display up to 5 valid news items
            news
                .filter(item => item.headline && item.url)
                .slice(0, 5)
                .forEach(item => {
                    const newsItem = document.createElement('div');
                    newsItem.className = 'news-item';
                    newsItem.innerHTML = `
                        <h3>${item.headline}</h3>
                        <p>${item.summary || 'No summary available'}</p>
                        <a href="${item.url}" target="_blank">Read more →</a>
                    `;
                    newsFeed.appendChild(newsItem);
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
            recentTickers = recentTickers.slice(0, 5); // Keep only 5 most recent
            localStorage.setItem('recentTickers', JSON.stringify(recentTickers));
            updateRecentTickersDisplay();
        }
    }

    function updateRecentTickersDisplay() {
        const recentTickers = JSON.parse(localStorage.getItem('recentTickers')) || [];
        recentTickersElement.innerHTML = '';
        
        recentTickers.forEach(ticker => {
            const tickerElement = document.createElement('div');
            tickerElement.className = 'recent-ticker';
            tickerElement.textContent = ticker;
            tickerElement.addEventListener('click', () => {
                tickerInput.value = ticker;
                fetchStockData();
            });
            recentTickersElement.appendChild(tickerElement);
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
            changeElement.textContent = `+$${Math.abs(data.change).toFixed(2)}`;
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
        document.getElementById('dayRange').textContent = `$${data.low.toFixed(2)} - $${data.high.toFixed(2)}`;
        document.getElementById('marketCap').textContent = data.marketCap;
    }

    function showError(message) {
        errorElement.innerHTML = `
            <p>ERROR: ${message}</p>
            <p>Please try:</p>
            <ul>
                <li>Checking your internet connection</li>
                <li>Verifying the stock symbol</li>
                <li>Waiting a moment and trying again</li>
            </ul>
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