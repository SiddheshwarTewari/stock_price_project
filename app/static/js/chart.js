document.addEventListener('DOMContentLoaded', function() {
    const chartElement = document.getElementById('priceChart');
    if (!chartElement) return;
    
    const ctx = chartElement.getContext('2d');
    const symbol = chartElement.dataset.symbol || 'AAPL';
    const timeFrame = chartElement.dataset.timeFrame || 'daily';
    
    // Initialize chart with loading state
    const chart = new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [{
            label: 'Loading data...',
            data: [],
            borderColor: 'rgba(75, 192, 192, 0.2)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)'
        }]},
        options: getChartOptions(symbol, timeFrame)
    });
    
    // Fetch and update chart data
    fetchChartData(symbol, timeFrame)
        .then(data => updateChart(chart, data))
        .catch(error => handleChartError(error));
});

function fetchChartData(symbol, timeFrame) {
    return fetch(`/api/stock/${symbol}?time_frame=${timeFrame}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            return processChartData(data);
        });
}

function processChartData(apiData) {
    const timeSeries = apiData.series || {};
    const labels = [];
    const closingPrices = [];
    
    // Process data in chronological order
    Object.entries(timeSeries)
        .sort((a, b) => new Date(a[0]) - new Date(b[0])) // Sort by date
        .forEach(([date, values]) => {
            labels.push(date);
            closingPrices.push(parseFloat(values['4. close']));
        });
    
    return {
        labels: labels,
        prices: closingPrices,
        symbol: apiData.symbol,
        timeFrame: apiData.time_frame
    };
}

function updateChart(chart, data) {
    chart.data.labels = data.labels;
    chart.data.datasets = [{
        label: `${data.symbol} Closing Price (${data.timeFrame})`,
        data: data.prices,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1,
        fill: true
    }];
    chart.update();
}

function handleChartError(error) {
    console.error('Chart error:', error);
    const chartContainer = document.getElementById('chartContainer');
    if (chartContainer) {
        chartContainer.innerHTML = `
            <div class="alert alert-danger">
                Failed to load chart data: ${error.message}
            </div>
        `;
    }
}

function getChartOptions(symbol, timeFrame) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: `${symbol} ${timeFrame} Prices`,
                font: { size: 16 }
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `$${context.parsed.y.toFixed(2)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    callback: function(value) {
                        return `$${value}`;
                    }
                }
            },
            x: {
                ticks: {
                    maxRotation: 45,
                    minRotation: 45
                }
            }
        }
    };
}