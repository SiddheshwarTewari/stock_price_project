/**
 * Stock Analysis Chart Module
 * Handles all chart rendering and data visualization
 */
class StockChart {
  constructor(canvasElement) {
    this.ctx = canvasElement.getContext('2d');
    this.symbol = canvasElement.dataset.symbol;
    this.timeFrame = canvasElement.dataset.timeFrame;
    this.chart = null;
    this.init();
  }

  async init() {
    try {
      const data = await this.fetchStockData();
      const processedData = this.processData(data);
      this.renderChart(processedData);
      this.addChartEvents();
    } catch (error) {
      console.error('Error initializing chart:', error);
      this.showError();
    }
  }

  async fetchStockData() {
    const response = await fetch(`/api/stock/${this.symbol}?time_frame=${this.timeFrame}`);
    if (!response.ok) throw new Error('Network response was not ok');
    return await response.json();
  }

  processData(data) {
    let timeSeries;
    switch(this.timeFrame) {
      case 'weekly':
        timeSeries = data['Weekly Time Series'] || {};
        break;
      case 'monthly':
        timeSeries = data['Monthly Time Series'] || {};
        break;
      default:
        timeSeries = data['Time Series (Daily)'] || {};
    }

    const labels = [];
    const closes = [];
    const opens = [];
    const highs = [];
    const lows = [];
    const volumes = [];

    Object.entries(timeSeries).forEach(([date, values]) => {
      labels.unshift(date);
      closes.unshift(parseFloat(values['4. close']));
      opens.unshift(parseFloat(values['1. open']));
      highs.unshift(parseFloat(values['2. high']));
      lows.unshift(parseFloat(values['3. low']));
      volumes.unshift(parseInt(values['5. volume']));
    });

    return {
      labels,
      datasets: {
        closes,
        opens,
        highs,
        lows,
        volumes
      }
    };
  }

  renderChart(data) {
    if (this.chart) this.chart.destroy();

    this.chart = new Chart(this.ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Closing Price',
            data: data.datasets.closes,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1,
            fill: true,
            yAxisID: 'y'
          },
          {
            label: 'Volume',
            data: data.datasets.volumes,
            type: 'bar',
            backgroundColor: 'rgba(201, 203, 207, 0.5)',
            yAxisID: 'y1',
            hidden: true
          }
        ]
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          title: {
            display: true,
            text: `${this.symbol} ${this.timeFrame.charAt(0).toUpperCase() + this.timeFrame.slice(1)} Price Chart`,
            font: {
              size: 16
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                let label = context.dataset.label || '';
                if (label.includes('Price')) {
                  label += ': $' + context.parsed.y.toFixed(2);
                } else if (label.includes('Volume')) {
                  label += ': ' + context.parsed.y.toLocaleString();
                }
                return label;
              }
            }
          },
          legend: {
            onClick: (e, legendItem, legend) => {
              const index = legendItem.datasetIndex;
              const ci = legend.chart;
              const meta = ci.getDatasetMeta(index);

              meta.hidden = !meta.hidden;
              ci.update();
            }
          }
        },
        scales: {
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
              callback: (value) => '$' + value
            }
          },
          y1: {
            type: 'linear',
            display: false,
            position: 'right',
            grid: {
              drawOnChartArea: false
            },
            ticks: {
              callback: (value) => value.toLocaleString()
            }
          }
        }
      }
    });
  }

  addChartEvents() {
    this.ctx.canvas.addEventListener('click', (event) => {
      const points = this.chart.getElementsAtEventForMode(
        event, 'nearest', { intersect: true }, true
      );
      if (points.length) {
        const point = points[0];
        const date = this.chart.data.labels[point.index];
        const price = this.chart.data.datasets[0].data[point.index];
        this.showPointDetails(date, price);
      }
    });
  }

  showPointDetails(date, price) {
    // In a real app, you might show a modal with more details
    console.log(`Selected point: ${date} at $${price.toFixed(2)}`);
  }

  showError() {
    this.ctx.canvas.parentElement.innerHTML = `
      <div class="alert alert-danger">
        Failed to load chart data. Please try again later.
      </div>
    `;
  }
}

// Initialize all charts on the page
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.stock-chart').forEach(canvas => {
    new StockChart(canvas);
  });
});