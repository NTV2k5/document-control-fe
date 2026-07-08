import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent } from 'reactjs-platform/ui';

type EngagementAnalyticsProps = {
  data: { name: string; views: number }[];
};

export function EngagementAnalytics({ data }: EngagementAnalyticsProps) {
  return (
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100">
      <CardContent className="p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Engagement Analytics</h3>
            <p className="mt-1 text-sm text-muted-foreground">File views last week</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-extrabold text-blue-600">24.5k</p>
            <p className="mt-1 text-sm font-bold text-emerald-500">+18.2%</p>
          </div>
        </div>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
                dy={10}
              />
              <Tooltip
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{
                  borderRadius: '12px',
                  border: 'none',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="views" radius={[8, 8, 8, 8]} barSize={50}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={index === data.length - 1 ? '#2563eb' : '#dbeafe'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
