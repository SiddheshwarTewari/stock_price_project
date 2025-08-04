require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware with enhanced CORS
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Alpha Vantage API Key (using your provided key)
const ALPHA_VANTAGE_KEY = 'W92E3Q6TGRVOVQR6';

// Cache to prevent hitting API rate limits
const cache = {
  search: {},
  quote: {},
  info: {},
  news: {},
  historical: {}
};

// Helper function to handle Alpha Vantage responses
const handleAVResponse = (data) => {
  if (data.Note || data.Information) {
    throw new Error(data.Note || data.Information || 'API limit reached');
  }
  return data;
};

// API Routes with error handling and caching
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const cacheKey = query.toLowerCase();
    
    if (cache.search[cacheKey]) {
      return res.json(cache.search[cacheKey]);
    }

    const response = await axios.get(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_KEY}`);
    const data = handleAVResponse(response.data);
    
    if (data.bestMatches) {
      const matches = data.bestMatches.map(match => ({
        symbol: match['1. symbol'],
        name: match['2. name']
      }));
      cache.search[cacheKey] = matches;
      res.json(matches);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch search results' });
  }
});

app.get('/api/quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = symbol.toLowerCase();
    
    if (cache.quote[cacheKey]) {
      return res.json(cache.quote[cacheKey]);
    }

    const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`);
    const data = handleAVResponse(response.data);
    
    if (data['Global Quote']) {
      const quote = data['Global Quote'];
      const result = {
        latestPrice: parseFloat(quote['05. price']),
        change: parseFloat(quote['09. change']),
        changePercent: parseFloat(quote['10. change percent']) / 100,
        volume: parseInt(quote['06. volume'])
      };
      cache.quote[cacheKey] = result;
      res.json(result);
    } else {
      res.status(404).json({ error: 'Quote not found' });
    }
  } catch (error) {
    console.error('Quote error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch quote data' });
  }
});

app.get('/api/info', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = symbol.toLowerCase();
    
    if (cache.info[cacheKey]) {
      return res.json(cache.info[cacheKey]);
    }

    const response = await axios.get(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`);
    const data = handleAVResponse(response.data);
    
    if (data && data.Symbol) {
      const result = {
        companyName: data.Name,
        symbol: data.Symbol,
        marketCap: parseFloat(data.MarketCapitalization),
        peRatio: parseFloat(data.PERatio),
        week52High: parseFloat(data['52WeekHigh']),
        week52Low: parseFloat(data['52WeekLow'])
      };
      cache.info[cacheKey] = result;
      res.json(result);
    } else {
      res.status(404).json({ error: 'Company not found' });
    }
  } catch (error) {
    console.error('Company info error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch company info' });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = symbol.toLowerCase();
    
    if (cache.news[cacheKey]) {
      return res.json(cache.news[cacheKey]);
    }

    const response = await axios.get(`https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`);
    const data = handleAVResponse(response.data);
    
    if (data.feed) {
      const news = data.feed.slice(0, 5).map(item => ({
        headline: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        publishedDate: new Date(item.time_published).getTime() / 1000
      }));
      cache.news[cacheKey] = news;
      res.json(news);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('News error:', error.message);
    // Fallback to Yahoo Finance if Alpha Vantage fails
    try {
      const yahooResponse = await axios.get(`https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&quotesCount=0&newsCount=5`);
      if (yahooResponse.data.news) {
        const news = yahooResponse.data.news.map(item => ({
          headline: item.title,
          summary: item.publisher,
          source: item.publisher,
          url: item.link,
          publishedDate: item.providerPublishTime
        }));
        res.json(news);
      } else {
        res.json([]);
      }
    } catch (yahooError) {
      res.status(500).json({ error: 'Failed to fetch news from all sources' });
    }
  }
});

app.get('/api/historical', async (req, res) => {
  try {
    const { symbol, range } = req.query;
    const cacheKey = `${symbol.toLowerCase()}-${range}`;
    
    if (cache.historical[cacheKey]) {
      return res.json(cache.historical[cacheKey]);
    }

    let functionName, outputSize, interval;
    switch(range) {
      case '1d':
        functionName = 'TIME_SERIES_INTRADAY';
        outputSize = 'compact';
        interval = '&interval=5min';
        break;
      case '5d':
        functionName = 'TIME_SERIES_DAILY';
        outputSize = 'compact';
        interval = '';
        break;
      case '1m':
        functionName = 'TIME_SERIES_DAILY';
        outputSize = 'compact';
        interval = '';
        break;
      case '1y':
        functionName = 'TIME_SERIES_DAILY';
        outputSize = 'full';
        interval = '';
        break;
      default:
        functionName = 'TIME_SERIES_DAILY';
        outputSize = 'compact';
        interval = '';
    }
    
    const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}${interval}&outputsize=${outputSize}&apikey=${ALPHA_VANTAGE_KEY}`;
    const response = await axios.get(url);
    const data = handleAVResponse(response.data);
    
    let timeSeries, labels = [], prices = [];
    
    if (range === '1d') {
      timeSeries = data['Time Series (5min)'];
    } else {
      timeSeries = data['Time Series (Daily)'];
    }
    
    if (!timeSeries) {
      return res.status(404).json({ error: 'Historical data not found' });
    }
    
    const timePoints = Object.keys(timeSeries).sort();
    
    timePoints.forEach(time => {
      labels.push(time);
      prices.push(parseFloat(timeSeries[time]['4. close']));
    });
    
    // Limit data points based on range
    let result;
    if (range === '1m') {
      result = {
        labels: labels.slice(0, 30).reverse(),
        data: prices.slice(0, 30).reverse()
      };
    } else if (range === '5d') {
      result = {
        labels: labels.slice(0, 5).reverse(),
        data: prices.slice(0, 5).reverse()
      };
    } else {
      result = {
        labels: labels.reverse(),
        data: prices.reverse()
      };
    }
    
    cache.historical[cacheKey] = result;
    res.json(result);
  } catch (error) {
    console.error('Historical data error:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch historical data' });
  }
});

// Serve the main page for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});