import {
  BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
  type ChartOptions,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);
ChartJS.defaults.color = '#8b93b3';
ChartJS.defaults.borderColor = 'rgba(42, 49, 80, 0.6)';
ChartJS.defaults.font.family = 'Rubik, system-ui, sans-serif';

const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export interface Series { label: string; data: (number | null)[]; color?: string; dashed?: boolean; fill?: boolean }

function baseOptions(yMin?: number, yMax?: number, legend = false): ChartOptions<'line'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: reduced ? false : undefined,
    interaction: { mode: 'index', intersect: false },
    plugins: { legend: { display: legend, labels: { boxWidth: 12 } } },
    scales: {
      y: { min: yMin, max: yMax, ticks: { precision: 0 } },
      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
    },
  };
}

export function LineChart({ labels, series, yMin, yMax, height = 220 }: {
  labels: string[]; series: Series[]; yMin?: number; yMax?: number; height?: number;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <Line
        options={baseOptions(yMin, yMax, series.length > 1)}
        data={{
          labels,
          datasets: series.map((s) => ({
            label: s.label,
            data: s.data,
            borderColor: s.color ?? '#f5c542',
            backgroundColor: (s.color ?? '#f5c542') + '33',
            borderDash: s.dashed ? [6, 4] : undefined,
            pointRadius: s.dashed ? 0 : labels.length > 40 ? 0 : 3,
            tension: 0.25,
            fill: s.fill ?? false,
            spanGaps: true,
          })),
        }}
      />
    </div>
  );
}

export function BarChart({ labels, values, colors, max, height = 240, horizontal = false, suffix = '' }: {
  labels: string[]; values: number[]; colors?: string[]; max?: number; height?: number; horizontal?: boolean; suffix?: string;
}) {
  return (
    <div className="chart-box" style={{ height }}>
      <Bar
        options={{
          responsive: true,
          maintainAspectRatio: false,
          animation: reduced ? false : undefined,
          indexAxis: horizontal ? 'y' : 'x',
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.formattedValue}${suffix}` } } },
          scales: horizontal
            ? { x: { min: 0, max }, y: { ticks: { autoSkip: false, font: { size: 11 } } } }
            : { y: { min: 0, max }, x: { ticks: { maxRotation: 0 } } },
        }}
        data={{ labels, datasets: [{ data: values, backgroundColor: colors ?? '#f5c542', borderRadius: 4 }] }}
      />
    </div>
  );
}
