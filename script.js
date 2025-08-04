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
            // Using Yahoo Finance without API (web scraping approach)
            const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`);
            
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
            
            // Fetch additional data from Yahoo Finance summary page
            const summaryResponse = await fetch(`https://finance.yahoo.com/quote/${ticker}`);
            const summaryHtml = await summaryResponse.text();
            
            // Parse additional data from HTML
            const parser = new DOMParser();
            const doc = parser.parseFromString(summaryHtml, 'text/html');
            
            // Extract company name
            const companyName = doc.querySelector('h1')?.textContent?.replace(` (${ticker})`, '') || ticker;
            
            // Extract other data points
            const prevClose = extractValue(doc, 'Previous Close');
            const open = extractValue(doc, 'Open');
            const dayRange = extractValue(doc, 'Day\\u0027s Range');
            const yearRange = extractValue(doc, '52 Week Range');
            const volume = extractValue(doc, 'Volume');
            const avgVolume = extractValue(doc, 'Avg. Volume');
            const marketCap = extractValue(doc, 'Market Cap');
            
            // Update the UI with the fetched data
            updateStockInfo({
                ticker,
                companyName,
                price: meta.regularMarketPrice,
                change: meta.regularMarketPrice - meta.chartPreviousClose,
                changePercent: ((meta.regularMarketPrice - meta.chartPreviousClose) / meta.chartPreviousClose) * 100,
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
    
    // Helper function to extract value from Yahoo Finance summary page
    function extractValue(doc, label) {
        try {
            const tdElements = Array.from(doc.querySelectorAll('td'));
            const labelElement = tdElements.find(el => el.textContent.trim() === label);
            if (labelElement && labelElement.nextElementSibling) {
                return labelElement.nextElementSibling.textContent.trim();
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
        priceElement.textContent = formatCurrency(data.price);
        priceElement.className = 'price';
        
        const changeElement = document.getElementById('change');
        const changePercentElement = document.getElementById('changePercent');
        
        if (data.change >= 0) {
            changeElement.textContent = `+${formatCurrency(data.change)}`;
            changeElement.classList.add('positive');
            changeElement.classList.remove('negative');
            
            changePercentElement.textContent = `+${data.changePercent.toFixed(2)}%`;
            changePercentElement.classList.add('positive');
            changePercentElement.classList.remove('negative');
        } else {
            changeElement.textContent = formatCurrency(data.change);
            changeElement.classList.add('negative');
            changeElement.classList.remove('positive');
            
            changePercentElement.textContent = `${data.changePercent.toFixed(2)}%`;
            changePercentElement.classList.add('negative');
            changePercentElement.classList.remove('positive');
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