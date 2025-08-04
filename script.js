document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const tickerInput = document.getElementById('tickerInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const stockInfoElement = document.getElementById('stockInfo');
    const recentTickersElement = document.getElementById('recentTickers');
    const datetimeElement = document.getElementById('datetime');
    
    // Finnhub API Key
    const FINNHUB_API_KEY = 'd283nthr01qr2iauh510d283nthr01qr2iauh51g';
    
    // Chart instance
    let stockChart;
    
    // Load recent tickers from localStorage
    let recentTickers = JSON.parse(localStorage.getItem('recentTickers')) || [];
    updateRecentTickersDisplay();
    
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
            // Fetch Quote Data
            const quoteData = await fetchFinnhubData(`quote?symbol=${ticker}`);
            
            // Fetch Company Profile
            const profileData = await fetchFinnhubData(`stock/profile2?symbol=${ticker}`);
            
            // Update UI with basic stock info
            updateStockInfo({
                ticker,
                companyName: profileData.name || ticker,
                price: quoteData.c || 0,
                change: quoteData.d || 0,
                changePercent: quoteData.dp || 0,
                prevClose: quoteData.pc || 0,
                open: quoteData.o || '-',
                high: quoteData.h || '-',
                low: quoteData.l || '-',
                marketCap: profileData.marketCapitalization ? formatMarketCap(profileData.marketCapitalization) : '-'
            });
            
            // Add to recent tickers
            updateRecentTickers(ticker);
            
            // Fetch and render additional data
            await Promise.all([
                renderStockChart(ticker),
                fetchNews(ticker)
            ]);
            
            // Show all sections
            loadingElement.classList.add('hidden');
            stockInfoElement.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error:', error);
            showError("Failed to fetch data. Please check the ticker and try again.");
            loadingElement.classList.add('hidden');
            errorElement.classList.remove('hidden');
        }
    }
    
    // Helper function for Finnhub API calls
    async function fetchFinnhubData(endpoint) {
        const response = await fetch(`https://finnhub.io/api/v1/${endpoint}&token=${FINNHUB_API_KEY}`);
        if (!response.ok) throw new Error(`API request failed for ${endpoint}`);
        return await response.json();
    }
    
    // Stock Chart Rendering
    // In the renderStockChart function, replace with this updated version:
    async function renderStockChart(ticker) {
        try {
            const data = await fetchFinnhubData(`stock/candle?symbol=${ticker}&resolution=D&count=30&token=${FINNHUB_API_KEY}`);
            
            // Check if we have valid data
            if (!data || !data.c || data.c.length === 0) {
                console.error('No valid chart data received');
                return;
            }

            const ctx = document.getElementById('stockChart').getContext('2d');
            
            // Destroy previous chart if it exists
            if (stockChart) {
                stockChart.destroy();
            }

            // Create new chart
            stockChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.t.map(timestamp => {
                        const date = new Date(timestamp * 1000);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }),
                    datasets: [{
                        label: 'Price',
                        data: data.c,
                        borderColor: 'var(--neon-blue)',
                        backgroundColor: 'rgba(0, 255, 252, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: true,
                        pointRadius: 0 // Remove points for cleaner look
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(context) {
                                    return `$${context.parsed.y.toFixed(2)}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                display: false,
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'var(--text-color)',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 10
                            }
                        },
                        y: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.1)'
                            },
                            ticks: {
                                color: 'var(--text-color)',
                                callback: function(value) {
                                    return `$${value}`;
                                }
                            }
                        }
                    },
                    interaction: {
                        mode: 'nearest',
                        axis: 'x',
                        intersect: false
                    }
                }
            });

            // Make sure to show the container
            document.getElementById('stockChartContainer').classList.remove('hidden');
            
        } catch (error) {
            console.error('Failed to load chart:', error);
            // Hide chart container if there's an error
            document.getElementById('stockChartContainer').classList.add('hidden');
        }
    }

    console.log('Chart data:', {
        labels: data.t.map(t => new Date(t * 1000)),
        values: data.c
    });
    
    // News Feed
    async function fetchNews(ticker) {
        try {
            const fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const toDate = new Date().toISOString().split('T')[0];
            
            const news = await fetchFinnhubData(`company-news?symbol=${ticker}&from=${fromDate}&to=${toDate}`);
            
            const newsFeed = document.getElementById('newsFeed');
            newsFeed.innerHTML = '';
            
            news.slice(0, 5).forEach(item => {
                if (item.headline && item.url) {
                    const newsItem = document.createElement('div');
                    newsItem.className = 'news-item';
                    newsItem.innerHTML = `
                        <h3>${item.headline}</h3>
                        <p>${item.summary || 'No summary available.'}</p>
                        <a href="${item.url}" target="_blank">Read more →</a>
                    `;
                    newsFeed.appendChild(newsItem);
                }
            });
            
            document.getElementById('newsContainer').classList.remove('hidden');
        } catch (error) {
            console.error('Failed to load news:', error);
        }
    }
    
    // Recent Tickers Management
    function updateRecentTickers(ticker) {
        if (!recentTickers.includes(ticker)) {
            recentTickers.unshift(ticker);
            if (recentTickers.length > 5) recentTickers.pop();
            localStorage.setItem('recentTickers', JSON.stringify(recentTickers));
            updateRecentTickersDisplay();
        }
    }
    
    function updateRecentTickersDisplay() {
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
        document.getElementById('yearRange').textContent = data.yearRange || '-';
        document.getElementById('marketCap').textContent = data.marketCap;
    }
    
    function showError(message) {
        errorElement.innerHTML = `<p>ERROR: ${message}</p><p>PLEASE VERIFY TICKER SYMBOL AND TRY AGAIN</p>`;
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