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
            // Using a CORS proxy to access Yahoo Finance
            const proxyUrl = 'https://api.allorigins.win/get?url=';
            const yahooUrl = encodeURIComponent(`https://finance.yahoo.com/quote/${ticker}`);
            
            const response = await fetch(`${proxyUrl}${yahooUrl}`);
            
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            
            const data = await response.json();
            
            // Parse the HTML content from the response
            const htmlContent = data.contents;
            
            if (!htmlContent || htmlContent.includes('Symbol Lookup from Yahoo Finance')) {
                throw new Error('Ticker not found');
            }
            
            // Create a DOM parser to extract data from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlContent, 'text/html');
            
            // Extract company name
            const companyName = doc.querySelector('h1')?.textContent?.replace(` (${ticker})`, '') || ticker;
            
            // Extract current price
            const priceElement = doc.querySelector('[data-field="regularMarketPrice"]');
            const price = priceElement ? parseFloat(priceElement.getAttribute('value')) : null;
            
            // Extract previous close
            const prevCloseElement = doc.querySelector('[data-test="PREV_CLOSE-value"]');
            const prevClose = prevCloseElement?.textContent || '-';
            
            // Extract other data points
            const open = extractValueFromTable(doc, 'Open');
            const dayRange = extractValueFromTable(doc, 'Day\'s Range');
            const yearRange = extractValueFromTable(doc, '52 Week Range');
            const volume = extractValueFromTable(doc, 'Volume');
            const avgVolume = extractValueFromTable(doc, 'Avg. Volume');
            const marketCap = extractValueFromTable(doc, 'Market Cap');
            
            // Calculate change and change percentage
            let change = '-';
            let changePercent = '-';
            
            if (price && prevClose !== '-' && !isNaN(parseFloat(prevClose.replace(/[^0-9.-]/g, '')))) {
                const prevCloseValue = parseFloat(prevClose.replace(/[^0-9.-]/g, ''));
                change = price - prevCloseValue;
                changePercent = (change / prevCloseValue) * 100;
            }
            
            // Update the UI with the fetched data
            updateStockInfo({
                ticker,
                companyName,
                price: price || '-',
                change,
                changePercent,
                prevClose,
                open,
                dayRange,
                yearRange,
                volume,
                avgVolume,
                marketCap
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
    
    // Helper function to extract value from Yahoo Finance summary table
    function extractValueFromTable(doc, label) {
        try {
            // Find all table rows
            const rows = Array.from(doc.querySelectorAll('tr'));
            
            // Find the row with the matching label
            const row = rows.find(r => {
                const th = r.querySelector('th');
                return th && th.textContent.trim() === label;
            });
            
            if (row) {
                const td = row.querySelector('td');
                return td ? td.textContent.trim() : '-';
            }
            return '-';
        } catch (e) {
            console.error(`Error extracting ${label}:`, e);
            return '-';
        }
    }
    
    // Function to update the stock info display
    function updateStockInfo(data) {
        document.getElementById('companyName').textContent = data.companyName;
        document.getElementById('symbol').textContent = data.ticker;
        
        const priceElement = document.getElementById('price');
        priceElement.textContent = data.price === '-' ? '-' : formatCurrency(data.price);
        priceElement.className = 'price';
        
        const changeElement = document.getElementById('change');
        const changePercentElement = document.getElementById('changePercent');
        
        if (typeof data.change === 'number') {
            if (data.change >= 0) {
                changeElement.textContent = `+${formatCurrency(data.change)}`;
                changeElement.className = 'positive';
                
                changePercentElement.textContent = `+${data.changePercent.toFixed(2)}%`;
                changePercentElement.className = 'positive';
            } else {
                changeElement.textContent = formatCurrency(data.change);
                changeElement.className = 'negative';
                
                changePercentElement.textContent = `${data.changePercent.toFixed(2)}%`;
                changePercentElement.className = 'negative';
            }
        } else {
            changeElement.textContent = '-';
            changeElement.className = '';
            
            changePercentElement.textContent = '-';
            changePercentElement.className = '';
        }
        
        document.getElementById('prevClose').textContent = data.prevClose;
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
    
    // Helper function to format currency
    function formatCurrency(value) {
        if (typeof value !== 'number') return value;
        return value.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }
    
    // Initialize with a popular stock
    tickerInput.value = 'AAPL';
    fetchStockData();
});