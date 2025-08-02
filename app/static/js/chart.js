document.addEventListener('DOMContentLoaded', function() {
    // First try to use data passed directly from template
    if (typeof chartData !== 'undefined' && chartData.labels && chartData.prices) {
        renderChart('priceChart', chartData.labels, chartData.prices, 
                  chartData.symbol || 'Stock', chartData.timeFrame || 'daily');
        return;
    }

    // Fallback to API call if direct data not available
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
            if (!data.labels || !data.prices) throw new Error('Invalid data format');
            
            // Render chart
            chartContainer.innerHTML = '<canvas id="priceChart"></canvas>';
            renderChart('priceChart', data.labels, data.prices, symbol, timeFrame);
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
    const ctx = document.getElementById(elementId).getContext('2d');
    
    // Determine chart color based on trend
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const chartColor = lastPrice >= firstPrice ? 'rgba(40, 167, 69, 1)' : 'rgba(220, 53, 69, 1)';
    const bgColor = lastPrice >= firstPrice ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)';
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `${symbol} Closing Price (${timeFrame})`,
                data: prices,
                borderColor: chartColor,
                backgroundColor: bgColor,
                borderWidth: 2,
                tension: 0.1,
                fill: true,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
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
                    },
                    grid: {
                        drawBorder: false
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}