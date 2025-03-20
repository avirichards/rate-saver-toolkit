
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { Download, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, SortAsc, SortDesc } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

// Define props interface with optional values to handle both uses
export interface DataTableProps {
  columns: any;
  data: any;
  title?: any;
  searchable?: boolean;
  searchColumn?: any;
  pagination?: boolean;
  exportData?: boolean;
  className?: any;
}

export function DataTable({ 
  columns, 
  data, 
  title, 
  searchable = true, 
  searchColumn,
  pagination = true, 
  exportData = true, 
  className 
}: DataTableProps) {
  const [sorting, setSorting] = useState<any[]>([]);
  const [columnFilters, setColumnFilters] = useState<any[]>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Mock react-table functionality since we don't have the actual import
  const table = {
    getHeaderGroups: () => [{
      id: 'header-group-1',
      headers: columns.map((col: any) => ({
        id: col.id || col.accessorKey,
        column: {
          getCanSort: () => true,
          getToggleSortingHandler: () => () => {},
          getIsSorted: () => false,
          columnDef: { header: col.header }
        },
        getContext: () => ({})
      }))
    }],
    getRowModel: () => ({
      rows: data.map((row: any, i: number) => ({
        id: `row-${i}`,
        getIsSelected: () => false,
        getVisibleCells: () => columns.map((col: any) => ({
          id: `cell-${i}-${col.id || col.accessorKey}`,
          column: {
            columnDef: { 
              cell: (info: any) => row[col.accessorKey] 
            }
          },
          getContext: () => ({})
        }))
      }))
    }),
    getState: () => ({
      pagination: {
        pageIndex: 0,
        pageSize: 10
      }
    }),
    getCanPreviousPage: () => false,
    getCanNextPage: () => data.length > 10,
    previousPage: () => {},
    nextPage: () => {},
    setPageIndex: () => {},
    setPageSize: () => {},
    getPageCount: () => Math.ceil(data.length / 10),
    getFilteredRowModel: () => ({
      rows: data
    })
  };

  const flexRender = (component: any, props: any) => {
    if (typeof component === 'function') {
      return component(props);
    }
    return component;
  };

  const handleExport = () => {
    // Implementation to export data as CSV
    const headers = columns.map((col: any) => 
      typeof col.header === 'string' ? col.header : col.id || col.accessorKey
    );
    
    const csvData = data.map((row: any) => {
      return columns.map((col: any) => {
        const value = row[col.accessorKey || col.id];
        return typeof value === 'string' ? `"${value}"` : String(value);
      }).join(',');
    });
    
    const csvContent = [
      headers.join(','),
      ...csvData
    ].join('\n');
    
    // Create and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title || 'data'}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className={cn("w-full", className)}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <div className="flex items-center gap-2">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={globalFilter ?? ''}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-8 w-[200px] lg:w-[250px]"
                />
              </div>
            )}
            
            {exportData && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={handleExport}
                iconLeft={<Download className="h-4 w-4" />}
              >
                Export
              </Button>
            )}
          </div>
        </CardHeader>
      )}
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap">
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn("flex items-center gap-1", header.column.getCanSort() && "cursor-pointer select-none")}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                          
                          {header.column.getIsSorted() === 'asc' && (
                            <SortAsc className="h-4 w-4" />
                          )}
                          
                          {header.column.getIsSorted() === 'desc' && (
                            <SortDesc className="h-4 w-4" />
                          )}
                        </div>
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            
            <TableBody>
              {table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {pagination && (
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div>
                Showing
                <span className="px-1 font-medium">
                  {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
                </span>
                to
                <span className="px-1 font-medium">
                  {Math.min(
                    (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                    table.getFilteredRowModel().rows.length
                  )}
                </span>
                of
                <span className="px-1 font-medium">
                  {table.getFilteredRowModel().rows.length}
                </span>
                entries
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Select
                value={table.getState().pagination.pageSize.toString()}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent>
                  {[5, 10, 20, 50, 100].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.previousPage()}  // Fixed: Removed argument
                  disabled={!table.getCanPreviousPage()}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.nextPage()}  // Fixed: Removed argument
                  disabled={!table.getCanNextPage()}  // This is correct now
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                  disabled={!table.getCanNextPage()}  // Fixed: Removed argument
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
