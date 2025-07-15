
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { FileBarChart, Filter, Search, Calendar, ArrowUpDown, Download, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';

// Sample report data
const reportsData = [
  { 
    id: 1, 
    name: 'Q1 Shipping Analysis', 
    date: '2023-04-01', 
    savings: 1250.45, 
    items: 450,
    carrier: 'Mixed',
    status: 'Completed'
  },
  { 
    id: 2, 
    name: 'West Coast Distribution', 
    date: '2023-03-15', 
    savings: 876.20, 
    items: 320,
    carrier: 'UPS',
    status: 'Completed'
  },
  { 
    id: 3, 
    name: 'East Region Audit', 
    date: '2023-02-28', 
    savings: 1543.75, 
    items: 520,
    carrier: 'FedEx',
    status: 'Completed'
  },
  { 
    id: 4, 
    name: 'International Shipping Review', 
    date: '2023-01-20', 
    savings: 3250.80, 
    items: 180,
    carrier: 'DHL',
    status: 'Completed'
  },
  { 
    id: 5, 
    name: 'Holiday Season Analysis', 
    date: '2022-12-31', 
    savings: 4180.25, 
    items: 940,
    carrier: 'Mixed',
    status: 'Completed'
  },
  { 
    id: 6, 
    name: 'Q4 Cost Review', 
    date: '2022-11-15', 
    savings: 2850.60, 
    items: 720,
    carrier: 'USPS',
    status: 'Completed'
  },
];

const ReportsPage = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  
  const filteredReports = reportsData.filter(report => 
    report.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    report.carrier.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Reports</h1>
            <p className="text-muted-foreground">View and manage your saved shipping analyses</p>
          </div>
          <div className="mt-4 md:mt-0">
            <Link to="/upload">
              <Button 
                variant="primary" 
                iconLeft={<FileBarChart className="h-4 w-4" />}
              >
                New Analysis
              </Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle>Saved Reports</CardTitle>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search reports..."
                    className="pl-8"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-9 w-9"
                >
                  <Filter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="all">All Reports</TabsTrigger>
                <TabsTrigger value="recent">Recent</TabsTrigger>
                <TabsTrigger value="saved">Saved</TabsTrigger>
              </TabsList>
              
              <TabsContent value="all" className="mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">
                          <div className="flex items-center gap-1">
                            Report Name
                            <ArrowUpDown className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-2">
                          <div className="flex items-center gap-1">
                            Date
                            <Calendar className="h-3 w-3" />
                          </div>
                        </th>
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{report.name}</td>
                          <td className="py-3 px-2">{new Date(report.date).toLocaleDateString()}</td>
                          <td className="py-3 px-2">{report.carrier}</td>
                          <td className="py-3 px-2 text-right">{report.items}</td>
                          <td className="py-3 px-2 text-right font-medium">${report.savings.toFixed(2)}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Link to={`/reports/${report.id}`}>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              <TabsContent value="recent" className="mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Report Name</th>
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.slice(0, 3).map((report) => (
                        <tr key={report.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{report.name}</td>
                          <td className="py-3 px-2">{new Date(report.date).toLocaleDateString()}</td>
                          <td className="py-3 px-2">{report.carrier}</td>
                          <td className="py-3 px-2 text-right">{report.items}</td>
                          <td className="py-3 px-2 text-right font-medium">${report.savings.toFixed(2)}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Link to={`/reports/${report.id}`}>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              
              <TabsContent value="saved" className="mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">Report Name</th>
                        <th className="text-left py-3 px-2">Date</th>
                        <th className="text-left py-3 px-2">Carrier</th>
                        <th className="text-right py-3 px-2">Items</th>
                        <th className="text-right py-3 px-2">Savings</th>
                        <th className="text-right py-3 px-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReports.filter((_, index) => index % 2 === 0).map((report) => (
                        <tr key={report.id} className="border-b hover:bg-muted/50">
                          <td className="py-3 px-2 font-medium">{report.name}</td>
                          <td className="py-3 px-2">{new Date(report.date).toLocaleDateString()}</td>
                          <td className="py-3 px-2">{report.carrier}</td>
                          <td className="py-3 px-2 text-right">{report.items}</td>
                          <td className="py-3 px-2 text-right font-medium">${report.savings.toFixed(2)}</td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                className="h-8 w-8"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Link to={`/reports/${report.id}`}>
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ReportsPage;
