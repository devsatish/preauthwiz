'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle, Clock, Bot } from 'lucide-react'

interface KpisProps {
  activeAuthCount: number
}

interface KpiCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
}

function KpiCard({ title, value, icon, description }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  )
}

export function DashboardKPIs({ activeAuthCount }: KpisProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Active Auths"
        value={activeAuthCount}
        icon={<Activity className="h-4 w-4" />}
        description="Currently in-flight authorizations"
      />
      <KpiCard
        title="First-pass Approval %"
        value="67%"
        icon={<CheckCircle className="h-4 w-4" />}
        description="Approved without additional review"
      />
      <KpiCard
        title="Median Time to Decision"
        value="2.3 days"
        icon={<Clock className="h-4 w-4" />}
        description="From submission to final decision"
      />
      <KpiCard
        title="AI-Assisted %"
        value="23%"
        icon={<Bot className="h-4 w-4" />}
        description="Reviews with AI recommendation"
      />
    </div>
  )
}
