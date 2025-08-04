document.addEventListener('DOMContentLoaded', function() {
    const tickerInput = document.getElementById('tickerInput');
    const searchBtn = document.getElementById('searchBtn');
    const loadingElement = document.getElementById('loading');
    const errorElement = document.getElementById('error');
    const stockInfoElement = document.getElementById('stockInfo');
    const recentTickersElement = document.getElementById('recentTickers');
    const datetimeElement = document.getElementById('datetime');
    
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
            // Using Yahoo Finance's API directly with JSONP approach
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
            
            // We'll use a CORS proxy as a fallback
            const proxyUrl = 'https://cors-anywhere.herokuapp.com/';
            
            let response;
            
            // First try direct API call
            try {
                response = await fetch(url, {
                    headers: {
                        'Origin': window.location.origin
                    }
                });
                
                if (!response.ok) throw new Error('Direct API failed');
            } catch (e) {
                // If direct API fails, try with CORS proxy
                console.log('Trying with CORS proxy');
                response = await fetch(proxyUrl + url, {
                    headers: {
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });
            }
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            
            // Check if data is valid
            if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
                throw new Error('No data available for this ticker');
            }
            
            const result = data.chart.result[0];
            const meta = result.meta;
            
            // For additional data, we'll use a different endpoint
            const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`;
            let summaryResponse = await fetch(proxyUrl + summaryUrl, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
            
            if (!summaryResponse.ok) {
                throw new Error('Could not fetch additional data');
            }
            
            const summaryData = await summaryResponse.json();
            const quoteSummary = summaryData.quoteSummary.result[0].price;
            
            // Update the UI with the fetched data
            updateStockInfo({
                ticker,
                companyName: quoteSummary.longName || ticker,
                price: meta.regularMarketPrice,
                change: meta.regularMarketPrice - meta.chartPreviousClose,
                changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
                prevClose: meta.chartPreviousClose.toFixed(2),
                open: quoteSummary.regularMarketOpen?.fmt || '-',
                dayRange: `${quoteSummary.regularMarketDayLow?.fmt || '-'} - ${quoteSummary.regularMarketDayHigh?.fmt || '-'}`,
                yearRange: quoteSummary.fiftyTwoWeekRange?.fmt || '-',
                volume: quoteSummary.regularMarketVolume?.fmt || '-',
                avgVolume: quoteSummary.averageDailyVolume3Month?.fmt || '-',
                marketCap: quoteSummary.marketCap?.fmt || '-'
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
        
        document.getElementById('prevClose').textContent = `$${data.prevClose}`;
        document.getElementById('open').textContent = data.open;
        document.getElementById('dayRange').textContent = data.dayRange;
        document.getElementById('yearRange').textContent = data.yearRange;
        document.getElementById('volume').textContent = data.volume;
        document.getElementById('avgVolume').textContent = data.avgVolume;
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