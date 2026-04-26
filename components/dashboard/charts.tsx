'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const submissionData = [
  { day: 'Mon', submissions: 18 },
  { day: 'Tue', submissions: 24 },
  { day: 'Wed', submissions: 31 },
  { day: 'Thu', submissions: 27 },
  { day: 'Fri', submissions: 35 },
  { day: 'Sat', submissions: 12 },
  { day: 'Sun', submissions: 9 },
]

const statusData = [
  { name: 'Pending', value: 42 },
  { name: 'Approved', value: 55 },
  { name: 'Denied', value: 18 },
  { name: 'Needs Info', value: 23 },
  { name: 'P2P Required', value: 11 },
]

const STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#22c55e',
  Denied: '#ef4444',
  'Needs Info': '#3b82f6',
  'P2P Required': '#a855f7',
}

export function DashboardCharts() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Submission Volume (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart
              data={submissionData}
              margin={{ top: 8, right: 16, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="submissionGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="submissions"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#submissionGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status Mix</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="45%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {statusData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] ?? '#94a3b8'}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
