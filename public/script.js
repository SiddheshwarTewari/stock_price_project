// DOM Elements
const stockSearch = document.getElementById('stock-search');
const searchBtn = document.getElementById('search-btn');
const randomBtn = document.getElementById('random-btn');
const suggestionsDropdown = document.getElementById('suggestions');
const datetimeElement = document.getElementById('datetime');
const apiStatusElement = document.getElementById('api-status');

// Stock Data Elements
const stockNameElement = document.getElementById('stock-name');
const stockTickerElement = document.getElementById('stock-ticker');
const stockPriceElement = document.getElementById('stock-price');
const stockChangeElement = document.getElementById('stock-change');
const stockChangePercentElement = document.getElementById('stock-change-percent');
const marketCapElement = document.getElementById('market-cap');
const peRatioElement = document.getElementById('pe-ratio');
const high52Element = document.getElementById('high-52');
const low52Element = document.getElementById('low-52');
const volumeElement = document.getElementById('volume');

// Company Info Elements
const companyDescription = document.getElementById('company-description');
const sectorElement = document.getElementById('sector');
const industryElement = document.getElementById('industry');
const dividendYieldElement = document.getElementById('dividend-yield');

// Chart Elements
const stockChartCtx = document.getElementById('stock-chart').getContext('2d');
const timeFilters = document.querySelectorAll('.time-filter');

// News Elements
const newsContainer = document.getElementById('news-container');

// Chart Instance
let stockChart = null;

// Popular Stocks for Random Button
const popularStocks = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META',
  'TSLA', 'NVDA', 'BRK.B', 'JPM', 'JNJ',
  'V', 'PG', 'HD', 'MA', 'DIS', 'ADBE',
  'PYPL', 'NFLX', 'CRM', 'INTC', 'CSCO',
  'PEP', 'KO', 'ABT', 'T', 'VZ', 'WMT',
  'COST', 'MRK', 'PFE', 'BA', 'XOM'
];

// Initialize the Application
function init() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Event Listeners
  searchBtn.addEventListener('click', searchStock);
  randomBtn.addEventListener('click', randomStock);
  
  stockSearch.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') {
      searchStock();
    } else {
      fetchSuggestions(stockSearch.value.trim());
    }
  });
  
  stockSearch.addEventListener('focus', () => {
    if (stockSearch.value.trim() && suggestionsDropdown.children.length > 0) {
      suggestionsDropdown.style.display = 'block';
    }
  });
  
  document.addEventListener('click', (e) => {
    if (!suggestionsDropdown.contains(e.target) && e.target !== stockSearch) {
      suggestionsDropdown.style.display = 'none';
    }
  });
  
  // Time Filter Buttons
  timeFilters.forEach(filter => {
    filter.addEventListener('click', () => {
      const range = filter.dataset.range;
      timeFilters.forEach(f => f.classList.remove('active'));
      filter.classList.add('active');
      
      const ticker = stockTickerElement.textContent;
      if (ticker && ticker !== 'SYMBOL') {
        fetchHistoricalData(ticker, range);
      }
    });
  });
  
  // Start with a random stock
  randomStock();
}

// Update Date and Time
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

// Search for a Stock
function searchStock() {
  const ticker = stockSearch.value.trim().toUpperCase();
  if (ticker) {
    fetchStockData(ticker);
  }
}

// Get a Random Stock
function randomStock() {
  const randomTicker = popularStocks[Math.floor(Math.random() * popularStocks.length)];
  stockSearch.value = randomTicker;
  fetchStockData(randomTicker);
}

// Fetch Stock Suggestions
async function fetchSuggestions(query) {
  if (!query) {
    suggestionsDropdown.style.display = 'none';
    return;
  }
  
  try {
    const response = await axios.get(`/api/search?query=${query}`);
    displaySuggestions(response.data);
  } catch (error) {
    console.error('Error fetching suggestions:', error);
    suggestionsDropdown.style.display = 'none';
  }
}

// Display Suggestions
function displaySuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    suggestionsDropdown.style.display = 'none';
    return;
  }
  
  suggestionsDropdown.innerHTML = '';
  
  suggestions.forEach(stock => {
    const suggestionItem = document.createElement('div');
    suggestionItem.className = 'suggestion-item';
    suggestionItem.innerHTML = `
      <span class="suggestion-ticker">${stock.symbol}</span>
      <span class="suggestion-name">${stock.name}</span>
    `;
    
    suggestionItem.addEventListener('click', () => {
      stockSearch.value = stock.symbol;
      suggestionsDropdown.style.display = 'none';
      fetchStockData(stock.symbol);
    });
    
    suggestionsDropdown.appendChild(suggestionItem);
  });
  
  suggestionsDropdown.style.display = 'block';
}

// Fetch Stock Data
async function fetchStockData(ticker) {
  try {
    apiStatusElement.textContent = 'API: FETCHING...';
    apiStatusElement.className = 'status-indicator active';
    
    // Fetch all data in parallel
    const [quoteData, companyData, newsData, historicalData] = await Promise.all([
      axios.get(`/api/quote?symbol=${ticker}`),
      axios.get(`/api/company?symbol=${ticker}`),
      axios.get(`/api/news?symbol=${ticker}`),
      axios.get(`/api/historical?symbol=${ticker}&range=1d`)
    ]);
    
    // Update UI
    updateStockUI(quoteData.data, companyData.data);
    displayNews(newsData.data);
    updateChart(historicalData.data);
    
    apiStatusElement.textContent = 'API: READY';
    apiStatusElement.className = 'status-indicator';
  } catch (error) {
    console.error('Error fetching stock data:', error);
    apiStatusElement.textContent = 'API: ERROR';
    apiStatusElement.className = 'status-indicator negative';
    
    // Show error to user
    stockNameElement.textContent = 'ERROR';
    stockTickerElement.textContent = 'ERROR';
    stockPriceElement.textContent = '--.--';
    stockChangeElement.textContent = '--.--';
    stockChangePercentElement.textContent = '--.--';
    
    newsContainer.innerHTML = `
      <div class="news-item">
        <div class="news-title">Failed to load data</div>
        <div class="news-source">${error.message || 'Unknown error'}</div>
      </div>
    `;
  }
}

// Update Stock UI
function updateStockUI(quoteData, companyData) {
  // Defensive: If either is missing or empty, show error
  if (!companyData || Object.keys(companyData).length === 0 || !quoteData || Object.keys(quoteData).length === 0) {
    stockNameElement.textContent = 'Not Found';
    stockTickerElement.textContent = 'N/A';
    stockPriceElement.textContent = '--.--';
    stockChangeElement.textContent = '--.--';
    stockChangePercentElement.textContent = '--.--';
    marketCapElement.textContent = 'N/A';
    peRatioElement.textContent = 'N/A';
    high52Element.textContent = 'N/A';
    low52Element.textContent = 'N/A';
    volumeElement.textContent = 'N/A';
    companyDescription.textContent = 'No company information found for this ticker.';
    sectorElement.textContent = 'N/A';
    industryElement.textContent = 'N/A';
    dividendYieldElement.textContent = 'N/A';
    return;
  }

  // Basic Info
  stockNameElement.textContent = companyData.name || 'N/A';
  stockTickerElement.textContent = companyData.symbol || 'N/A';

  // Price Data
  const price = typeof quoteData.price === 'number' && !isNaN(quoteData.price) ? quoteData.price : null;
  const change = typeof quoteData.change === 'number' && !isNaN(quoteData.change) ? quoteData.change : null;
  const changePercent = typeof quoteData.changePercent === 'number' && !isNaN(quoteData.changePercent) ? quoteData.changePercent : null;

  stockPriceElement.textContent = price !== null ? price.toFixed(2) : 'N/A';
  stockChangeElement.textContent = change !== null ? change.toFixed(2) : 'N/A';
  stockChangePercentElement.textContent = changePercent !== null ? changePercent.toFixed(2) + '%' : 'N/A';

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

  // Additional Info
  marketCapElement.textContent = companyData.marketCap ? formatMarketCap(companyData.marketCap) : 'N/A';
  peRatioElement.textContent = companyData.peRatio && !isNaN(companyData.peRatio) ? Number(companyData.peRatio).toFixed(2) : 'N/A';
  high52Element.textContent = companyData.high52 && !isNaN(companyData.high52) ? parseFloat(companyData.high52).toFixed(2) : 'N/A';
  low52Element.textContent = companyData.low52 && !isNaN(companyData.low52) ? parseFloat(companyData.low52).toFixed(2) : 'N/A';
  volumeElement.textContent = quoteData.volume && !isNaN(quoteData.volume) ? formatNumber(quoteData.volume) : 'N/A';

  // Company Info
  companyDescription.textContent = companyData.description || 'No description available.';
  sectorElement.textContent = companyData.sector || 'N/A';
  industryElement.textContent = companyData.industry || 'N/A';
  dividendYieldElement.textContent = (
    companyData.dividendYield && !isNaN(companyData.dividendYield)
      ? (parseFloat(companyData.dividendYield) * 100).toFixed(2) + '%'
      : 'N/A'
  );
}

// Format Market Cap
function formatMarketCap(marketCap) {
  if (!marketCap) return 'N/A';
  
  const num = parseFloat(marketCap);
  if (num >= 1e12) {
    return '$' + (num / 1e12).toFixed(2) + 'T';
  } else if (num >= 1e9) {
    return '$' + (num / 1e9).toFixed(2) + 'B';
  } else if (num >= 1e6) {
    return '$' + (num / 1e6).toFixed(2) + 'M';
  } else {
    return '$' + num.toFixed(2);
  }
}

// Format Large Numbers
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Display News Articles
function displayNews(newsData) {
  if (!newsData || newsData.length === 0) {
    newsContainer.innerHTML = `
      <div class="news-item">
        <div class="news-title">No news available for this stock</div>
        <div class="news-source">CyberStock Nexus</div>
      </div>
    `;
    return;
  }
  
  newsContainer.innerHTML = '';
  
  newsData.forEach(news => {
    const newsItem = document.createElement('div');
    newsItem.className = 'news-item';
    
    const date = new Date(news.date || Date.now());
    const formattedDate = date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    newsItem.innerHTML = `
      <div class="news-title">${news.title || 'No title'}</div>
      ${news.summary ? `<div class="news-summary">${news.summary}</div>` : ''}
      <div class="news-source">${news.source || 'Unknown source'}</div>
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

// Fetch Historical Data
async function fetchHistoricalData(ticker, range) {
  try {
    const response = await axios.get(`/api/historical?symbol=${ticker}&range=${range}`);
    updateChart(response.data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
  }
}

// Update Chart
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