import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, FileText, Eye, Layers, Clock } from "lucide-react";

type ResourceView = {
  resource_id: string;
  viewed_at: string;
};

type Resource = {
  id: string;
  title: string;
  subject_id: string;
  subjects: { name: string } | null;
};

type AnalyticsData = {
  resource: Resource;
  viewCount: number;
  lastViewed: string | null;
};

export default function AnalyticsTab() {
  const [data, setData] = useState<AnalyticsData[]>([]);
  const [totals, setTotals] = useState({ pdfs: 0, views: 0, subjects: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [
        { data: resources },
        { data: views },
        { count: subjectsCount }
      ] = await Promise.all([
        supabase.from("resources").select("id, title, subject_id, subjects(name)"),
        supabase.from("resource_views").select("resource_id, viewed_at"),
        supabase.from("subjects").select("*", { count: "exact", head: true })
      ]);

      const resList = (resources as Resource[]) || [];
      const viewList = (views as ResourceView[]) || [];

      const viewMap = new Map<string, { count: number; lastViewed: string | null }>();
      
      viewList.forEach((v) => {
        const current = viewMap.get(v.resource_id) || { count: 0, lastViewed: null };
        current.count += 1;
        if (!current.lastViewed || new Date(v.viewed_at) > new Date(current.lastViewed)) {
          current.lastViewed = v.viewed_at;
        }
        viewMap.set(v.resource_id, current);
      });

      const analyticsData: AnalyticsData[] = resList.map((r) => {
        const stats = viewMap.get(r.id) || { count: 0, lastViewed: null };
        return {
          resource: r,
          viewCount: stats.count,
          lastViewed: stats.lastViewed,
        };
      });

      analyticsData.sort((a, b) => b.viewCount - a.viewCount);

      setData(analyticsData);
      setTotals({
        pdfs: resList.length,
        views: viewList.length,
        subjects: subjectsCount || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
          <Skeleton className="h-24 rounded-card" />
        </div>
        <Skeleton className="h-[400px] rounded-card" />
      </div>
    );
  }

  const top3 = data.slice(0, 3);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Eye className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Views</p>
            <p className="text-3xl font-heading font-bold dark:text-gray-100">{totals.views}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total PDFs</p>
            <p className="text-3xl font-heading font-bold dark:text-gray-100">{totals.pdfs}</p>
          </div>
        </Card>
        <Card className="p-6 flex items-center gap-4 dark:bg-gray-900 dark:border-gray-800">
          <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Subjects</p>
            <p className="text-3xl font-heading font-bold dark:text-gray-100">{totals.subjects}</p>
          </div>
        </Card>
      </div>

      {top3.length > 0 && top3[0].viewCount > 0 && (
        <div className="space-y-4">
          <h3 className="font-heading font-semibold flex items-center gap-2 dark:text-gray-100">
            <BarChart3 className="w-5 h-5 text-indigo-500" />
            Top Resources
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3.map((d, i) => d.viewCount > 0 && (
              <Card key={d.resource.id} className="p-5 flex flex-col justify-between dark:bg-gray-900 dark:border-gray-800 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-indigo-500/10 to-transparent dark:from-indigo-500/20 rounded-bl-full" />
                <div>
                  <div className="text-xs font-semibold text-indigo-500 mb-1">#{i + 1} Most Viewed</div>
                  <h4 className="font-medium line-clamp-2 dark:text-gray-100">{d.resource.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{d.resource.subjects?.name}</p>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground dark:text-gray-200">{d.viewCount} views</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {d.lastViewed ? new Date(d.lastViewed).toLocaleDateString() : "Never"}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="font-heading font-semibold dark:text-gray-100">All Resources Performance</h3>
        <Card className="overflow-hidden dark:bg-gray-900 dark:border-gray-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 font-medium">Resource Title</th>
                  <th className="px-6 py-3 font-medium">Subject</th>
                  <th className="px-6 py-3 font-medium text-right">Total Views</th>
                  <th className="px-6 py-3 font-medium text-right">Last Viewed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border dark:divide-gray-800">
                {data.map((d) => (
                  <tr key={d.resource.id} className="bg-white dark:bg-gray-900 hover:bg-muted/50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-foreground dark:text-gray-100 truncate max-w-[200px] md:max-w-[400px]">
                      {d.resource.title}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                      {d.resource.subjects?.name}
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-foreground dark:text-gray-200">
                      {d.viewCount}
                    </td>
                    <td className="px-6 py-4 text-right text-muted-foreground whitespace-nowrap">
                      {d.lastViewed ? new Date(d.lastViewed).toLocaleDateString() : "-"}
                    </td>
                  </tr>
                ))}
                {data.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">
                      No resources found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
