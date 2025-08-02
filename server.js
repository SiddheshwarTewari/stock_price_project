require('dotenv').config();
const express = require('express');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Alpha Vantage API Key
const ALPHA_VANTAGE_KEY = process.env.ALPHA_VANTAGE_KEY || 'demo'; // Use 'demo' for testing but get your own key

// API Routes
app.get('/api/search', async (req, res) => {
    try {
        const { query } = req.query;
        const response = await axios.get(`https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_KEY}`);
        
        if (response.data.bestMatches) {
            const matches = response.data.bestMatches.map(match => ({
                symbol: match['1. symbol'],
                name: match['2. name']
            }));
            res.json(matches);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Search error:', error.message);
        res.status(500).json({ error: 'Failed to fetch search results' });
    }
});

app.get('/api/quote', async (req, res) => {
    try {
        const { symbol } = req.query;
        const response = await axios.get(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`);
        
        if (response.data['Global Quote']) {
            const quote = response.data['Global Quote'];
            res.json({
                latestPrice: parseFloat(quote['05. price']),
                change: parseFloat(quote['09. change']),
                changePercent: parseFloat(quote['10. change percent']) / 100,
                volume: parseInt(quote['06. volume'])
            });
        } else {
            res.status(404).json({ error: 'Quote not found' });
        }
    } catch (error) {
        console.error('Quote error:', error.message);
        res.status(500).json({ error: 'Failed to fetch quote data' });
    }
});

app.get('/api/info', async (req, res) => {
    try {
        const { symbol } = req.query;
        const response = await axios.get(`https://www.alphavantage.co/query?function=OVERVIEW&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`);
        
        if (response.data) {
            res.json({
                companyName: response.data.Name,
                symbol: response.data.Symbol,
                marketCap: parseFloat(response.data.MarketCapitalization),
                peRatio: parseFloat(response.data.PERatio),
                week52High: parseFloat(response.data['52WeekHigh']),
                week52Low: parseFloat(response.data['52WeekLow'])
            });
        } else {
            res.status(404).json({ error: 'Company not found' });
        }
    } catch (error) {
        console.error('Company info error:', error.message);
        res.status(500).json({ error: 'Failed to fetch company info' });
    }
});

// Alpha Vantage doesn't have news endpoint in free tier, so we'll use Yahoo Finance
app.get('/api/news', async (req, res) => {
    try {
        const { symbol } = req.query;
        const response = await axios.get(`https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&quotesCount=0&newsCount=5`);
        
        if (response.data.news) {
            const news = response.data.news.map(item => ({
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
    } catch (error) {
        console.error('News error:', error.message);
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

app.get('/api/historical', async (req, res) => {
    try {
        const { symbol, range } = req.query;
        let functionName, outputSize;
        
        switch(range) {
            case '1d':
                functionName = 'TIME_SERIES_INTRADAY';
                outputSize = 'compact';
                break;
            case '5d':
                functionName = 'TIME_SERIES_DAILY';
                outputSize = 'compact';
                break;
            case '1m':
                functionName = 'TIME_SERIES_DAILY';
                outputSize = 'compact';
                break;
            case '1y':
                functionName = 'TIME_SERIES_DAILY';
                outputSize = 'full';
                break;
            default:
                functionName = 'TIME_SERIES_DAILY';
                outputSize = 'compact';
        }
        
        const interval = range === '1d' ? '&interval=5min' : '';
        const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}${interval}&outputsize=${outputSize}&apikey=${ALPHA_VANTAGE_KEY}`;
        
        const response = await axios.get(url);
        let timeSeries;
        
        if (range === '1d') {
            timeSeries = response.data['Time Series (5min)'];
        } else {
            timeSeries = response.data['Time Series (Daily)'];
        }
        
        if (!timeSeries) {
            return res.status(404).json({ error: 'Historical data not found' });
        }
        
        const timePoints = Object.keys(timeSeries).sort();
        const labels = [];
        const prices = [];
        
        timePoints.forEach(time => {
            labels.push(time);
            prices.push(parseFloat(timeSeries[time]['4. close']));
        });
        
        // For 1m and 5d ranges, we need to limit the data points
        if (range === '1m') {
            res.json({
                labels: labels.slice(0, 30).reverse(),
                data: prices.slice(0, 30).reverse()
            });
        } else if (range === '5d') {
            res.json({
                labels: labels.slice(0, 5).reverse(),
                data: prices.slice(0, 5).reverse()
            });
        } else {
            res.json({
                labels: labels.reverse(),
                data: prices.reverse()
            });
        }
    } catch (error) {
        console.error('Historical data error:', error.message);
        res.status(500).json({ error: 'Failed to fetch historical data' });
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