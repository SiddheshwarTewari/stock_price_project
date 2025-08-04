require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Hardcoded Alpha Vantage API Key
const ALPHA_VANTAGE_KEY = 'RBXMFITJ8OMCM8HA';

// Cache implementation
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// API Routes
app.get('/api/search', async (req, res) => {
  try {
    const { query } = req.query;
    const cacheKey = `search-${query}`;
    
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    const response = await axios.get(
      `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    const data = response.data;
    if (data.Note) throw new Error('API rate limit reached');
    
    const results = data.bestMatches?.map(match => ({
      symbol: match['1. symbol'],
      name: match['2. name']
    })) || [];
    
    cache.set(cacheKey, results, CACHE_DURATION);
    res.json(results);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/quote', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = `quote-${symbol}`;
    
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    const response = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    const data = response.data;
    if (data.Note) throw new Error('API rate limit reached');
    
    const quote = data['Global Quote'] || {};
    const result = {
      price: parseFloat(quote['05. price']),
      change: parseFloat(quote['09. change']),
      changePercent: parseFloat(quote['10. change percent']),
      volume: parseInt(quote['06. volume'])
    };
    
    cache.set(cacheKey, result, CACHE_DURATION);
    res.json(result);
  } catch (error) {
    console.error('Quote error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/company', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = `company-${symbol}`;
    
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    const response = await axios.get(
      `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    const data = response.data;
    if (data.Note) throw new Error('API rate limit reached');
    
    const result = {
      name: data.Name,
      description: data.Description,
      sector: data.Sector,
      industry: data.Industry,
      marketCap: data.MarketCapitalization,
      peRatio: data.PERatio,
      dividendYield: data.DividendYield,
      high52: data['52WeekHigh'],
      low52: data['52WeekLow']
    };
    
    cache.set(cacheKey, result, CACHE_DURATION);
    res.json(result);
  } catch (error) {
    console.error('Company error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/historical', async (req, res) => {
  try {
    const { symbol, range } = req.query;
    const cacheKey = `historical-${symbol}-${range}`;
    
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    let functionName, interval = '';
    switch(range) {
      case '1d':
        functionName = 'TIME_SERIES_INTRADAY';
        interval = '&interval=5min';
        break;
      case '1w':
      case '1m':
      case '1y':
        functionName = 'TIME_SERIES_DAILY';
        break;
      default:
        functionName = 'TIME_SERIES_DAILY';
    }
    
    const response = await axios.get(
      `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}${interval}&apikey=${ALPHA_VANTAGE_KEY}`
    );
    
    const data = response.data;
    if (data.Note) throw new Error('API rate limit reached');
    
    const timeSeries = data[`Time Series (${range === '1d' ? '5min' : 'Daily'})`] || {};
    const timePoints = Object.keys(timeSeries).sort();
    
    const labels = [];
    const prices = [];
    
    timePoints.forEach(time => {
      labels.push(time);
      prices.push(parseFloat(timeSeries[time]['4. close']));
    });
    
    // Limit data points based on range
    let limit = 100;
    if (range === '1d') limit = 24 * 12; // 5min intervals for 24 hours
    if (range === '1w') limit = 7;
    if (range === '1m') limit = 30;
    
    const result = {
      labels: labels.slice(0, limit).reverse(),
      data: prices.slice(0, limit).reverse()
    };
    
    cache.set(cacheKey, result, CACHE_DURATION);
    res.json(result);
  } catch (error) {
    console.error('Historical error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/news', async (req, res) => {
  try {
    const { symbol } = req.query;
    const cacheKey = `news-${symbol}`;
    
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    // First try Alpha Vantage
    try {
      const response = await axios.get(
        `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
      );
      
      const data = response.data;
      if (!data.Note && data.feed) {
        const news = data.feed.slice(0, 5).map(item => ({
          title: item.title,
          summary: item.summary,
          source: item.source,
          url: item.url,
          date: item.time_published
        }));
        cache.set(cacheKey, news, CACHE_DURATION);
        return res.json(news);
      }
    } catch (avError) {
      console.log('Falling back to Yahoo Finance');
    }
    
    // Fallback to Yahoo Finance
    const yahooResponse = await axios.get(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&quotesCount=0&newsCount=5`
    );
    
    const news = yahooResponse.data.news?.map(item => ({
      title: item.title,
      source: item.publisher,
      url: item.link,
      date: new Date(item.providerPublishTime).toISOString()
    })) || [];
    
    cache.set(cacheKey, news, CACHE_DURATION);
    res.json(news);
  } catch (error) {
    console.error('News error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`CyberStock Nexus running on port ${PORT}`);
});