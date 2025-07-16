
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Package, LayoutDashboard, FileBarChart, BarChart3, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AppSidebar() {
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    {
      title: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Reports',
      path: '/reports',
      icon: FileBarChart,
    },
    {
      title: 'Settings',
      path: '/settings',
      icon: Settings,
    },
  ];

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader className="py-4">
        <Link to="/" className="flex items-center gap-2 px-4">
          <div className="bg-primary text-primary-foreground p-1.5 rounded">
            <Package className="h-5 w-5" />
          </div>
          <span className="font-semibold text-lg tracking-tight">ShipRate Pro</span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.path)}
                    tooltip={item.title}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      
      <SidebarFooter className="mt-auto border-t border-sidebar-border py-4">
        <div className="px-3 text-xs text-muted-foreground">
          <p>ShipRate Pro v1.0.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
