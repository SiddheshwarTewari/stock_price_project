document.addEventListener('DOMContentLoaded', function() {
    const chartContainer = document.getElementById('chartContainer');
    if (!chartContainer) return;
    
    const symbol = chartContainer.dataset.symbol || 'AAPL';
    const timeFrame = chartContainer.dataset.timeFrame || 'daily';
    
    // Show loading state
    chartContainer.innerHTML = '<p class="text-center">Loading chart data...</p>';
    
    fetch(`/api/stock/${symbol}?time_frame=${timeFrame}`)
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            if (data.error) throw new Error(data.error);
            
            // Find the time series data
            const timeSeriesKey = Object.keys(data).find(key => key.includes('Time Series'));
            if (!timeSeriesKey) throw new Error('No time series data found');
            
            const timeSeries = data[timeSeriesKey];
            const sortedData = Object.entries(timeSeries)
                .sort((a, b) => new Date(a[0]) - new Date(b[0]));
            
            const labels = sortedData.map(item => item[0]);
            const prices = sortedData.map(item => parseFloat(item[1]['4. close']));
            
            // Render chart
            chartContainer.innerHTML = '<canvas id="priceChart"></canvas>';
            renderChart('priceChart', labels, prices, symbol, timeFrame);
        })
        .catch(error => {
            console.error('Error:', error);
            chartContainer.innerHTML = `
                <div class="alert alert-danger">
                    Failed to load chart: ${error.message}<br>
                    <small>Try refreshing the page or checking the stock symbol</small>
                </div>
            `;
        });
});

function renderChart(elementId, labels, prices, symbol, timeFrame) {
    new Chart(document.getElementById(elementId), {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Closing Price (${timeFrame})`,
                data: prices,
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: `${symbol} ${timeFrame} Price Chart`,
                    font: {
                        size: 16
                    }
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
        }
    });
}