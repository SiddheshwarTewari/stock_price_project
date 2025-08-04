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
        document.getElementById('newsContainer').classList.add('hidden');
        
        try {
            // Fetch Quote Data
            const quoteData = await fetchFinnhubData(`quote?symbol=${ticker}`);
            
            // Fetch Company Profile
            const profileData = await fetchFinnhubData(`stock/profile2?symbol=${ticker}`);
            
            // Fetch Financial Metrics
            const metricsData = await fetchFinnhubData(`stock/metric?symbol=${ticker}&metric=all`);
            
            // Fetch Recommendations
            const recommendationsData = await fetchFinnhubData(`stock/recommendation?symbol=${ticker}`);
            
            // Fetch Peers
            const peersData = await fetchFinnhubData(`stock/peers?symbol=${ticker}`);
            
            // Fetch Earnings Calendar
            const earningsData = await fetchFinnhubData(`calendar/earnings?symbol=${ticker}&limit=3`);
            
            // Update UI with all data
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
                yearRange: metricsData.metric['52WeekHigh'] && metricsData.metric['52WeekLow'] 
                    ? `${metricsData.metric['52WeekLow'].toFixed(2)} - ${metricsData.metric['52WeekHigh'].toFixed(2)}` 
                    : '-',
                marketCap: profileData.marketCapitalization ? formatMarketCap(profileData.marketCapitalization) : '-',
                peRatio: metricsData.metric.peNormalizedAnnual ? metricsData.metric.peNormalizedAnnual.toFixed(2) : '-',
                eps: metricsData.metric.epsNormalizedAnnual ? metricsData.metric.epsNormalizedAnnual.toFixed(2) : '-',
                dividend: metricsData.metric.dividendYieldIndicatedAnnual 
                    ? (metricsData.metric.dividendYieldIndicatedAnnual * 100).toFixed(2) + '%' 
                    : '-',
                beta: metricsData.metric.beta ? metricsData.metric.beta.toFixed(2) : '-'
            });
            
            // Update recommendations
            updateRecommendations(recommendationsData);
            
            // Update peers
            updatePeers(peersData);
            
            // Update earnings calendar
            updateEarningsCalendar(earningsData.earningsCalendar || []);
            
            // Add to recent tickers
            updateRecentTickers(ticker);
            
            // Fetch news
            await fetchNews(ticker);
            
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
    
    // Update recommendations
    function updateRecommendations(data) {
        const recommendationsElement = document.getElementById('recommendations');
        recommendationsElement.innerHTML = '';
        
        if (!data || data.length === 0) {
            recommendationsElement.innerHTML = '<p>No recommendations available</p>';
            return;
        }
        
        // Get latest recommendation
        const latest = data[0];
        
        // Create recommendation summary
        const summary = document.createElement('p');
        summary.innerHTML = `Consensus: <span class="${getRecommendationClass(latest.consensus)}">${latest.consensus}</span>`;
        recommendationsElement.appendChild(summary);
        
        // Create recommendation bar
        const bar = document.createElement('div');
        bar.className = 'recommendation-bar';
        
        const segments = [
            { label: 'Strong Buy', value: latest.strongBuy, color: '#2ecc71' },
            { label: 'Buy', value: latest.buy, color: '#27ae60' },
            { label: 'Hold', value: latest.hold, color: '#f39c12' },
            { label: 'Sell', value: latest.sell, color: '#e74c3c' },
            { label: 'Strong Sell', value: latest.strongSell, color: '#c0392b' }
        ];
        
        segments.forEach(segment => {
            if (segment.value > 0) {
                const segmentElement = document.createElement('div');
                segmentElement.className = 'recommendation-segment';
                segmentElement.style.width = `${segment.value * 20}%`;
                segmentElement.style.backgroundColor = segment.color;
                segmentElement.title = `${segment.label}: ${segment.value}`;
                bar.appendChild(segmentElement);
            }
        });
        
        recommendationsElement.appendChild(bar);
        
        // Add period info
        const period = document.createElement('p');
        period.style.fontSize = '12px';
        period.style.marginTop = '5px';
        period.textContent = `As of ${new Date(latest.period).toLocaleDateString()}`;
        recommendationsElement.appendChild(period);
    }
    
    function getRecommendationClass(consensus) {
        if (consensus >= 4) return 'positive';
        if (consensus >= 2.5) return '';
        return 'negative';
    }
    
    // Update peers
    function updatePeers(peers) {
        const peersElement = document.getElementById('peers');
        peersElement.innerHTML = '';
        
        if (!peers || peers.length === 0) {
            peersElement.innerHTML = '<p>No peers data available</p>';
            return;
        }
        
        peers.slice(0, 10).forEach(peer => {
            const peerElement = document.createElement('div');
            peerElement.className = 'peer-ticker';
            peerElement.textContent = peer;
            peerElement.addEventListener('click', () => {
                tickerInput.value = peer;
                fetchStockData();
            });
            peersElement.appendChild(peerElement);
        });
    }
    
    // Update earnings calendar
    function updateEarningsCalendar(earnings) {
        const earningsElement = document.getElementById('earningsCalendar');
        earningsElement.innerHTML = '';
        
        if (!earnings || earnings.length === 0) {
            earningsElement.innerHTML = '<p>No upcoming earnings data</p>';
            return;
        }
        
        earnings.forEach(earning => {
            const earningItem = document.createElement('div');
            earningItem.className = 'earnings-item';
            
            const date = new Date(earning.date);
            const formattedDate = date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
            
            earningItem.innerHTML = `
                <span class="earnings-date">${formattedDate}</span>
                <span>EPS Estimate: <span class="earnings-estimate">${earning.epsEstimate ? earning.epsEstimate.toFixed(2) : '-'}</span></span>
            `;
            
            earningsElement.appendChild(earningItem);
        });
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
        document.getElementById('yearRange').textContent = data.yearRange;
        document.getElementById('marketCap').textContent = data.marketCap;
        document.getElementById('peRatio').textContent = data.peRatio;
        document.getElementById('eps').textContent = data.eps;
        document.getElementById('dividend').textContent = data.dividend;
        document.getElementById('beta').textContent = data.beta;
    }
    
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