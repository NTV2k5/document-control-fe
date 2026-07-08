import { FileText, Image as ImageIcon, Video, FileArchive } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Card, CardContent } from 'reactjs-platform/ui';

type FileDistributionProps = {
  data: { name: string; value: number; color: string }[];
};

export function FileDistribution({ data }: FileDistributionProps) {
  const getIcon = (name: string) => {
    switch (name) {
      case 'DOCUMENTS': {
        return <FileText className="h-6 w-6 text-blue-400" strokeWidth={2} />;
      }
      case 'IMAGES': {
        return <ImageIcon className="h-6 w-6 text-green-400" strokeWidth={2} />;
      }
      case 'VIDEOS': {
        return <Video className="h-6 w-6 text-pink-400" strokeWidth={2} />;
      }
      case 'OTHERS':
      default: {
        return <FileArchive className="h-6 w-6 text-slate-400" strokeWidth={2} />;
      }
    }
  };

  const getBg = (name: string) => {
    switch (name) {
      case 'DOCUMENTS': {
        return 'bg-blue-50';
      }
      case 'IMAGES': {
        return 'bg-green-50';
      }
      case 'VIDEOS': {
        return 'bg-pink-50';
      }
      case 'OTHERS':
      default: {
        return 'bg-slate-100';
      }
    }
  };

  return (
    <Card className="rounded-2xl border-none shadow-sm ring-1 ring-slate-100">
      <CardContent className="p-8">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">File Distribution</h3>
            <p className="mt-1 text-sm text-muted-foreground">Split by file type</p>
          </div>
          <div className="h-16 w-16 shrink-0 flex items-center justify-center">
            <PieChart width={64} height={64}>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={24}
                outerRadius={32}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {data.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-100 transition-shadow hover:shadow-md"
            >
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <span className="text-xs font-bold tracking-wider text-muted-foreground uppercase">
                    {item.name}
                  </span>
                </div>
                <p className="text-2xl font-extrabold text-slate-900">{item.value}</p>
              </div>
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${getBg(item.name)}`}
              >
                {getIcon(item.name)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
