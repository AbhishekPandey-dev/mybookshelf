import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart3, 
  FileText, 
  Eye, 
  BookOpen, 
  TrendingUp, 
  Calendar,
  ChevronUp,
  ChevronDown,
  Search
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

interface ResourceStat {
  id: string;
  title: string;
  subject: string;
  views: number;
  lastViewed: string | null;
}

const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPdfs: 0,
    totalViews: 0,
    totalSubjects: 0
  });
  const [topResources, setTopResources] = useState<ResourceStat[]>([]);
  const [allResources, setAllResources] = useState<ResourceStat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: keyof ResourceStat; direction: 'asc' | 'desc' }>({
    key: 'views',
    direction: 'desc'
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      const { data: resources, error: resError } = await supabase
        .from('resources')
        .select('id, title, subject_id, subjects(name)');
      
      if (resError) throw resError;

      const { data: views, error: viewsError } = await supabase
        .from('resource_views')
        .select('resource_id, viewed_at')
        .order('viewed_at', { ascending: false });

      if (viewsError) throw viewsError;

      const subjects = new Set(resources?.map(r => r.subjects?.name).filter(Boolean));
      const viewCounts: Record<string, { count: number; lastViewed: string | null }> = {};
      
      views?.forEach(v => {
        if (!viewCounts[v.resource_id]) {
          viewCounts[v.resource_id] = { count: 0, lastViewed: v.viewed_at };
        }
        viewCounts[v.resource_id].count++;
      });

      const processedResources: ResourceStat[] = (resources || []).map(r => ({
        id: r.id,
        title: r.title,
        subject: r.subjects?.name || "Unknown",
        views: viewCounts[r.id]?.count || 0,
        lastViewed: viewCounts[r.id]?.lastViewed || null
      }));

      setStats({
        totalPdfs: resources?.length || 0,
        totalViews: views?.length || 0,
        totalSubjects: subjects.size
      });

      const sorted = [...processedResources].sort((a, b) => b.views - a.views);
      setTopResources(sorted.slice(0, 3));
      setAllResources(processedResources);
      
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: keyof ResourceStat) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const sortedAndFilteredResources = allResources
    .filter(r => 
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.subject.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];
      
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return sortConfig.direction === 'asc' 
        ? (aValue as number) - (bValue as number)
        : (bValue as number) - (aValue as number);
    });

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Card key={i} className="border-none bg-white/50 backdrop-blur-sm shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-none bg-white/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total PDFs</CardTitle>
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600 group-hover:scale-110 transition-transform">
              <FileText className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalPdfs}</div>
            <p className="text-xs text-muted-foreground mt-1">Uploaded resources</p>
          </CardContent>
        </Card>

        <Card className="border-none bg-white/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Views</CardTitle>
            <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 group-hover:scale-110 transition-transform">
              <Eye className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalViews}</div>
            <p className="text-xs text-muted-foreground mt-1">Student engagements</p>
          </CardContent>
        </Card>

        <Card className="border-none bg-white/60 backdrop-blur-md shadow-sm hover:shadow-md transition-all group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Subjects</CardTitle>
            <div className="p-2 bg-violet-50 rounded-lg text-violet-600 group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalSubjects}</div>
            <p className="text-xs text-muted-foreground mt-1">Categories covered</p>
          </CardContent>
        </Card>
      </div>

      {/* Top Resources */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-semibold">Top 3 Most Viewed</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {topResources.map((resource, index) => (
            <div 
              key={resource.id}
              className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200 group hover:scale-[1.02] transition-transform cursor-default"
            >
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:bg-white/20 transition-colors" />
              <Badge variant="outline" className="bg-white/20 border-white/30 text-white mb-3 hover:bg-white/30">
                #{index + 1} Popular
              </Badge>
              <h3 className="font-bold text-lg leading-tight mb-2 line-clamp-2">{resource.title}</h3>
              <p className="text-indigo-100 text-sm mb-4">{resource.subject}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-200" />
                  <span className="font-semibold">{resource.views} views</span>
                </div>
              </div>
            </div>
          ))}
          {topResources.length === 0 && (
            <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
              <Eye className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No view data available yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Full Stats Table */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">All Resources Statistics</h2>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search resources..." 
              className="pl-10 bg-white/50 border-none shadow-sm focus-visible:ring-indigo-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gray-50/50 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('title')}>
                    <div className="flex items-center gap-2">
                      Resource Title
                      {sortConfig.key === 'title' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('subject')}>
                    <div className="flex items-center gap-2">
                      Subject
                      {sortConfig.key === 'subject' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('views')}>
                    <div className="flex items-center gap-2">
                      Views
                      {sortConfig.key === 'views' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                  <th className="px-6 py-4 font-medium text-gray-500 cursor-pointer hover:text-indigo-600 transition-colors" onClick={() => handleSort('lastViewed')}>
                    <div className="flex items-center gap-2">
                      Last Viewed
                      {sortConfig.key === 'lastViewed' && (sortConfig.direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedAndFilteredResources.map((resource) => (
                  <tr key={resource.id} className="hover:bg-indigo-50/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">{resource.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 font-normal">{resource.subject}</Badge>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">
                      {resource.views.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5" />
                        {resource.lastViewed 
                          ? new Date(resource.lastViewed).toLocaleDateString() + ' ' + new Date(resource.lastViewed).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Never'
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {sortedAndFilteredResources.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">No resources found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsTab;
