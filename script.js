document.addEventListener('DOMContentLoaded', function() {
    const tickerInput = document.getElementById('tickerInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const stockInfoElement = document.getElementById('stockInfo');
    const recentTickersElement = document.getElementById('recentTickers');
    const datetimeElement = document.getElementById('datetime');
    
    // Finnhub API Key
    const FINNHUB_API_KEY = 'd2837khr01qr2iauetf0d2837khr01qr2iauetfg';
    
    // Load recent tickers from localStorage
    let recentTickers = JSON.parse(localStorage.getItem('recentTickers')) || [];
    updateRecentTickersDisplay();
    
    // Update datetime every second
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Event listeners
    searchBtn.addEventListener('click', fetchStockData);
    tickerInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            fetchStockData();
        }
    });
    
    // Function to fetch stock data
    async function fetchStockData() {
        const ticker = tickerInput.value.trim().toUpperCase();
        
        if (!ticker) {
            showError("Please enter a ticker symbol");
            return;
        }
        
        // Show loading, hide other elements
        loadingElement.classList.remove('hidden');
        errorElement.classList.add('hidden');
        stockInfoElement.classList.add('hidden');
        
        try {
            // Fetch quote data (price, change, etc.)
            const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
            const quoteResponse = await fetch(quoteUrl);
            
            if (!quoteResponse.ok) {
                throw new Error('Failed to fetch quote data');
            }
            
            const quoteData = await quoteResponse.json();
            
            // Fetch company profile (name, market cap, etc.)
            const profileUrl = `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${FINNHUB_API_KEY}`;
            const profileResponse = await fetch(profileUrl);
            
            if (!profileResponse.ok) {
                throw new Error('Failed to fetch company profile');
            }
            
            const profileData = await profileResponse.json();
            
            // Calculate change percentage
            const changePercent = quoteData.dp || 0;
            const change = quoteData.d || 0;
            const prevClose = quoteData.pc || 0;
            
            // Update the UI with the fetched data
            updateStockInfo({
                ticker,
                companyName: profileData.name || ticker,
                price: quoteData.c || 0,
                change: change,
                changePercent: changePercent,
                prevClose: prevClose,
                open: quoteData.o || '-',
                high: quoteData.h || '-',
                low: quoteData.l || '-',
                marketCap: profileData.marketCapitalization ? `$${(profileData.marketCapitalization / 1000000000).toFixed(2)}B` : '-',
                currency: profileData.currency || 'USD'
            });
            
            // Add to recent tickers if not already there
            if (!recentTickers.includes(ticker)) {
                recentTickers.unshift(ticker);
                if (recentTickers.length > 5) {
                    recentTickers.pop();
                }
                localStorage.setItem('recentTickers', JSON.stringify(recentTickers));
                updateRecentTickersDisplay();
            }
            
            // Hide loading, show stock info
            loadingElement.classList.add('hidden');
            stockInfoElement.classList.remove('hidden');
            
        } catch (error) {
            console.error('Error fetching stock data:', error);
            showError("Failed to fetch data. Please check the ticker symbol and try again.");
            loadingElement.classList.add('hidden');
            errorElement.classList.remove('hidden');
        }
    }
    
    // Function to update the stock info display
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
    
    // Function to show error message
    function showError(message) {
        errorElement.innerHTML = `<p>ERROR: ${message}</p><p>PLEASE VERIFY TICKER SYMBOL AND TRY AGAIN</p>`;
        errorElement.classList.remove('hidden');
    }
    
    // Function to update recent tickers display
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
    
    // Function to update date and time
    function updateDateTime() {
        const now = new Date();
        const date = now.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        const time = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        datetimeElement.textContent = `${date} ${time}`;
    }
    
    // Initialize with a popular stock
    tickerInput.value = 'AAPL';
    fetchStockData();
});