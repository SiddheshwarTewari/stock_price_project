// DOM Elements
const stockInput = document.getElementById('stock-input');
const searchBtn = document.getElementById('search-btn');
const randomBtn = document.getElementById('random-btn');
const suggestionsContainer = document.getElementById('suggestions');
const datetimeElement = document.getElementById('datetime');
const apiStatusElement = document.getElementById('api-status');

// Stock data elements
const stockNameElement = document.getElementById('stock-name');
const stockTickerElement = document.getElementById('stock-ticker');
const stockPriceElement = document.getElementById('stock-price');
const stockChangeElement = document.getElementById('stock-change');
const stockChangePercentElement = document.getElementById('stock-change-percent');
const stockMarketCapElement = document.getElementById('stock-market-cap');
const stockPeElement = document.getElementById('stock-pe');
const stockHighElement = document.getElementById('stock-high');
const stockLowElement = document.getElementById('stock-low');
const stockVolumeElement = document.getElementById('stock-volume');
const newsContainer = document.getElementById('news-container');
const timeFilters = document.querySelectorAll('.time-filter');
const stockChartCtx = document.getElementById('stock-chart').getContext('2d');

// Chart instance
let stockChart = null;

// Popular stocks for random button
const popularStocks = [
    'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 
    'TSLA', 'NVDA', 'BRK.B', 'JPM', 'JNJ',
    'V', 'PG', 'HD', 'MA', 'DIS', 'ADBE',
    'PYPL', 'NFLX', 'CRM', 'INTC', 'CSCO',
    'PEP', 'KO', 'ABT', 'T', 'VZ', 'WMT',
    'COST', 'MRK', 'PFE', 'BA', 'XOM'
];

// Initialize the app
function init() {
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Event listeners
    searchBtn.addEventListener('click', () => {
        const ticker = stockInput.value.trim().toUpperCase();
        if (ticker) fetchStockData(ticker);
    });
    
    randomBtn.addEventListener('click', () => {
        const randomTicker = popularStocks[Math.floor(Math.random() * popularStocks.length)];
        stockInput.value = randomTicker;
        fetchStockData(randomTicker);
    });
    
    stockInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            const ticker = stockInput.value.trim().toUpperCase();
            if (ticker) fetchStockData(ticker);
        } else {
            fetchSuggestions(stockInput.value.trim());
        }
    });
    
    stockInput.addEventListener('focus', () => {
        if (stockInput.value.trim() && suggestionsContainer.children.length > 0) {
            suggestionsContainer.style.display = 'block';
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
    
    // Time filter buttons
    timeFilters.forEach(filter => {
        filter.addEventListener('click', () => {
            const range = filter.dataset.range;
            timeFilters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');
            
            const ticker = stockTickerElement.textContent;
            if (ticker && ticker !== 'TICKER') {
                fetchHistoricalData(ticker, range);
            }
        });
    });
    
    // Start with a random stock
    randomBtn.click();
}

// Update date and time
function updateDateTime() {
    const now = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    };
    datetimeElement.textContent = now.toLocaleDateString('en-US', options);
}

// Fetch stock suggestions
async function fetchSuggestions(query) {
    if (!query) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    try {
        const response = await axios.get(`/api/search?query=${query}`);
        displaySuggestions(response.data);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        suggestionsContainer.style.display = 'none';
    }
}

// Display suggestions
function displaySuggestions(suggestions) {
    if (!suggestions || suggestions.length === 0) {
        suggestionsContainer.style.display = 'none';
        return;
    }
    
    suggestionsContainer.innerHTML = '';
    
    suggestions.forEach(stock => {
        const suggestionItem = document.createElement('div');
        suggestionItem.className = 'suggestion-item';
        suggestionItem.innerHTML = `
            <span class="suggestion-ticker">${stock.symbol}</span>
            <span class="suggestion-name">${stock.name}</span>
        `;
        
        suggestionItem.addEventListener('click', () => {
            stockInput.value = stock.symbol;
            suggestionsContainer.style.display = 'none';
            fetchStockData(stock.symbol);
        });
        
        suggestionsContainer.appendChild(suggestionItem);
    });
    
    suggestionsContainer.style.display = 'block';
}

// Fetch stock data
async function fetchStockData(ticker) {
    try {
        apiStatusElement.textContent = 'API: FETCHING...';
        apiStatusElement.className = 'status-active';
        
        // Fetch quote data
        const quoteResponse = await axios.get(`/api/quote?symbol=${ticker}`);
        const quoteData = quoteResponse.data;
        
        // Fetch company info
        const infoResponse = await axios.get(`/api/info?symbol=${ticker}`);
        const infoData = infoResponse.data;
        
        // Fetch news
        const newsResponse = await axios.get(`/api/news?symbol=${ticker}`);
        const newsData = newsResponse.data;
        
        // Fetch historical data for chart
        const historicalResponse = await axios.get(`/api/historical?symbol=${ticker}&range=1d`);
        const historicalData = historicalResponse.data;
        
        // Update UI with all data
        updateStockUI(quoteData, infoData);
        displayNews(newsData);
        updateChart(historicalData);
        
        apiStatusElement.textContent = 'API: READY';
        apiStatusElement.className = '';
    } catch (error) {
        console.error('Error fetching stock data:', error);
        apiStatusElement.textContent = 'API: ERROR';
        apiStatusElement.className = 'negative';
    }
}

// Update stock UI with data
function updateStockUI(quoteData, infoData) {
    // Basic info
    stockNameElement.textContent = infoData.companyName || 'N/A';
    stockTickerElement.textContent = infoData.symbol || 'N/A';
    
    // Price data
    const price = quoteData.latestPrice || 0;
    const change = quoteData.change || 0;
    const changePercent = quoteData.changePercent || 0;
    
    stockPriceElement.textContent = price.toFixed(2);
    stockChangeElement.textContent = change.toFixed(2);
    stockChangePercentElement.textContent = (changePercent * 100).toFixed(2) + '%';
    
    // Set color based on change
    if (change > 0) {
        stockChangeElement.className = 'data-value positive';
        stockChangePercentElement.className = 'data-value positive';
    } else if (change < 0) {
        stockChangeElement.className = 'data-value negative';
        stockChangePercentElement.className = 'data-value negative';
    } else {
        stockChangeElement.className = 'data-value';
        stockChangePercentElement.className = 'data-value';
    }
    
    // Additional info
    stockMarketCapElement.textContent = formatMarketCap(infoData.marketCap);
    stockPeElement.textContent = infoData.peRatio ? infoData.peRatio.toFixed(2) : 'N/A';
    stockHighElement.textContent = infoData.week52High ? infoData.week52High.toFixed(2) : 'N/A';
    stockLowElement.textContent = infoData.week52Low ? infoData.week52Low.toFixed(2) : 'N/A';
    stockVolumeElement.textContent = quoteData.volume ? formatNumber(quoteData.volume) : 'N/A';
}

// Format market cap
function formatMarketCap(marketCap) {
    if (!marketCap) return 'N/A';
    
    if (marketCap >= 1e12) {
        return '$' + (marketCap / 1e12).toFixed(2) + 'T';
    } else if (marketCap >= 1e9) {
        return '$' + (marketCap / 1e9).toFixed(2) + 'B';
    } else if (marketCap >= 1e6) {
        return '$' + (marketCap / 1e6).toFixed(2) + 'M';
    } else {
        return '$' + marketCap.toFixed(2);
    }
}

// Format large numbers
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Display news articles
function displayNews(newsData) {
    if (!newsData || newsData.length === 0) {
        newsContainer.innerHTML = `
            <div class="news-item placeholder">
                <div class="news-title">NO NEWS AVAILABLE FOR THIS STOCK</div>
                <div class="news-source">NEON_TRADER NETWORK</div>
            </div>
        `;
        return;
    }
    
    newsContainer.innerHTML = '';
    
    newsData.forEach(news => {
        const newsItem = document.createElement('div');
        newsItem.className = 'news-item';
        
        const date = new Date(news.datetime * 1000 || news.publishedDate);
        const formattedDate = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        newsItem.innerHTML = `
            <div class="news-title">${news.headline || news.title}</div>
            <div class="news-summary">${news.summary || ''}</div>
            <div class="news-source">${news.source || ''}</div>
            <div class="news-date">${formattedDate}</div>
        `;
        
        if (news.url) {
            newsItem.addEventListener('click', () => {
                window.open(news.url, '_blank');
            });
        }
        
        newsContainer.appendChild(newsItem);
    });
}

// Fetch historical data for chart
async function fetchHistoricalData(ticker, range) {
    try {
        const response = await axios.get(`/api/historical?symbol=${ticker}&range=${range}`);
        updateChart(response.data);
    } catch (error) {
        console.error('Error fetching historical data:', error);
    }
}

// Update chart with historical data
function updateChart(historicalData) {
    if (!historicalData || !historicalData.labels || !historicalData.data) {
        return;
    }
    
    const chartData = {
        labels: historicalData.labels,
        datasets: [{
            label: 'Price',
            data: historicalData.data,
            borderColor: '#0ff0fc',
            backgroundColor: 'rgba(15, 240, 252, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0
        }]
    };
    
    const chartOptions = {
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
                        return 'Price: $' + context.parsed.y.toFixed(2);
                    }
                }
            }
        },
        scales: {
            x: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#a0a0a0'
                }
            },
            y: {
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                },
                ticks: {
                    color: '#a0a0a0',
                    callback: function(value) {
                        return '$' + value.toFixed(2);
                    }
                }
            }
        },
        interaction: {
            mode: 'nearest',
            axis: 'x',
            intersect: false
        }
    };
    
    if (stockChart) {
        stockChart.data = chartData;
        stockChart.update();
    } else {
        stockChart = new Chart(stockChartCtx, {
            type: 'line',
            data: chartData,
            options: chartOptions
        });
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', init);