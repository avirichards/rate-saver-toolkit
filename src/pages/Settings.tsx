
import React from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui-lov/Card';
import { Button } from '@/components/ui-lov/Button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, User, Shield, BellRing, Truck, Cog, Database, CheckCircle, AlertTriangle, Zap } from 'lucide-react';
import { UpsTestButton } from '@/components/ui-lov/UpsTestButton';
import { CarrierAccountManager } from '@/components/ui-lov/CarrierAccountManager';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const SettingsPage = () => {
  const [upsConfig, setUpsConfig] = useState({
    client_id: '',
    client_secret: '',
    account_number: '',
    is_sandbox: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [upsConfigExists, setUpsConfigExists] = useState(false);

  useEffect(() => {
    loadUpsConfig();
  }, []);

  const loadUpsConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ups_configs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setUpsConfig({
          client_id: data.client_id,
          client_secret: data.client_secret,
          account_number: data.account_number || '',
          is_sandbox: data.is_sandbox
        });
        setUpsConfigExists(true);
      }
    } catch (error) {
      console.error('Error loading UPS config:', error);
    }
  };

  const saveUpsConfig = async () => {
    if (!upsConfig.client_id || !upsConfig.client_secret) {
      toast.error('Please enter both Client ID and Client Secret');
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Please log in to save UPS configuration');
        return;
      }

      if (upsConfigExists) {
        // Update existing config
        const { error } = await supabase
          .from('ups_configs')
          .update({
            client_id: upsConfig.client_id,
            client_secret: upsConfig.client_secret,
            account_number: upsConfig.account_number,
            is_sandbox: upsConfig.is_sandbox
          })
          .eq('user_id', user.id)
          .eq('is_active', true);

        if (error) throw error;
      } else {
        // Insert new config
        const { error } = await supabase
          .from('ups_configs')
          .insert({
            user_id: user.id,
            client_id: upsConfig.client_id,
            client_secret: upsConfig.client_secret,
            account_number: upsConfig.account_number,
            is_sandbox: upsConfig.is_sandbox
          });

        if (error) throw error;
        setUpsConfigExists(true);
      }

      toast.success('UPS configuration saved successfully');
    } catch (error) {
      console.error('Error saving UPS config:', error);
      toast.error('Failed to save UPS configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const testUpsConnection = async () => {
    if (!upsConfig.client_id || !upsConfig.client_secret) {
      toast.error('Please save your UPS configuration first');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ups-auth', {
        body: { action: 'get_token' }
      });

      if (error || !data.access_token) {
        throw new Error(error?.message || 'Failed to authenticate with UPS');
      }

      toast.success('UPS connection successful!');
    } catch (error) {
      console.error('Error testing UPS connection:', error);
      toast.error(`UPS connection failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-1">Settings</h1>
            <p className="text-muted-foreground">Manage your application preferences and account settings</p>
          </div>
        </div>

        <Tabs defaultValue="account" className="space-y-6">
          <TabsList className="grid grid-cols-3 lg:grid-cols-6 w-full h-auto md:w-auto">
            <TabsTrigger value="account" className="flex gap-2 items-center">
              <User className="h-4 w-4" />
              <span className="hidden md:inline">Account</span>
            </TabsTrigger>
            <TabsTrigger value="carriers" className="flex gap-2 items-center">
              <Truck className="h-4 w-4" />
              <span className="hidden md:inline">Carriers</span>
            </TabsTrigger>
            <TabsTrigger value="ups" className="flex gap-2 items-center">
              <Truck className="h-4 w-4" />
              <span className="hidden md:inline">UPS API</span>
            </TabsTrigger>
            <TabsTrigger value="api" className="flex gap-2 items-center">
              <Database className="h-4 w-4" />
              <span className="hidden md:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex gap-2 items-center">
              <BellRing className="h-4 w-4" />
              <span className="hidden md:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex gap-2 items-center">
              <Shield className="h-4 w-4" />
              <span className="hidden md:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="preferences" className="flex gap-2 items-center">
              <Cog className="h-4 w-4" />
              <span className="hidden md:inline">Preferences</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="account">
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Update your account details and settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" defaultValue="John Doe" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input id="email" defaultValue="john.doe@example.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input id="company" defaultValue="ACME Logistics" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Input id="role" defaultValue="Shipping Manager" />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="carriers">
            <CarrierAccountManager />
          </TabsContent>
          
          <TabsContent value="ups">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  UPS API Configuration
                  {upsConfigExists && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </CardTitle>
                <CardDescription>
                  Configure your UPS API credentials for real-time rate shopping
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ups-client-id">UPS Client ID</Label>
                    <Input 
                      id="ups-client-id" 
                      value={upsConfig.client_id}
                      onChange={(e) => setUpsConfig({...upsConfig, client_id: e.target.value})}
                      placeholder="Enter your UPS API Client ID" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ups-client-secret">UPS Client Secret</Label>
                    <Input 
                      id="ups-client-secret" 
                      type="password"
                      value={upsConfig.client_secret}
                      onChange={(e) => setUpsConfig({...upsConfig, client_secret: e.target.value})}
                      placeholder="Enter your UPS API Client Secret" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ups-account">UPS Account Number (Optional)</Label>
                    <Input 
                      id="ups-account" 
                      value={upsConfig.account_number}
                      onChange={(e) => setUpsConfig({...upsConfig, account_number: e.target.value})}
                      placeholder="Enter your UPS Account Number" 
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Sandbox Mode</div>
                      <div className="text-sm text-muted-foreground">Use UPS testing environment</div>
                    </div>
                    <Switch 
                      checked={upsConfig.is_sandbox}
                      onCheckedChange={(checked) => setUpsConfig({...upsConfig, is_sandbox: checked})}
                    />
                  </div>
                </div>
                
                {upsConfig.is_sandbox && (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4 flex items-start">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-700">
                      <p className="font-medium">Sandbox Mode Active</p>
                      <p>You're using UPS's testing environment. Switch to production when ready to go live.</p>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <Button 
                    variant="outline" 
                    onClick={testUpsConnection}
                    disabled={isLoading}
                    iconLeft={<Zap className="h-4 w-4" />}
                  >
                    Test Connection
                  </Button>
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                    onClick={saveUpsConfig}
                    disabled={isLoading}
                  >
                    Save Configuration
                  </Button>
                </div>
                
                {/* Enhanced UPS Testing */}
                <div className="pt-6 border-t">
                  <UpsTestButton />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="api">
            <Card>
              <CardHeader>
                <CardTitle>API Configuration</CardTitle>
                <CardDescription>Manage API keys for carrier rate connections</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ups-api">UPS API Key</Label>
                    <div className="flex gap-2">
                      <Input id="ups-api" defaultValue="ups_api_key_123456abcdef" type="password" />
                      <Button variant="outline">Show</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fedex-api">FedEx API Key</Label>
                    <div className="flex gap-2">
                      <Input id="fedex-api" defaultValue="fedex_api_key_123456abcdef" type="password" />
                      <Button variant="outline">Show</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="usps-api">USPS API Key</Label>
                    <div className="flex gap-2">
                      <Input id="usps-api" placeholder="Enter your USPS API key" />
                      <Button variant="outline">Validate</Button>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Control which notifications you receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Email Notifications</div>
                      <div className="text-sm text-muted-foreground">Receive emails for important events</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Analysis Completion</div>
                      <div className="text-sm text-muted-foreground">Notify when shipping analysis is complete</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Rate Changes</div>
                      <div className="text-sm text-muted-foreground">Alert when carrier rates change significantly</div>
                    </div>
                    <Switch defaultChecked />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Weekly Reports</div>
                      <div className="text-sm text-muted-foreground">Receive weekly summary reports</div>
                    </div>
                    <Switch />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="security">
            <Card>
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Manage your account security preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                  >
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="preferences">
            <Card>
              <CardHeader>
                <CardTitle>Application Preferences</CardTitle>
                <CardDescription>Customize your application experience</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="theme">UI Theme</Label>
                    <Select defaultValue="dark">
                      <SelectTrigger id="theme">
                        <SelectValue placeholder="Select theme" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System Default</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="default-view">Default View</Label>
                    <Select defaultValue="dashboard">
                      <SelectTrigger id="default-view">
                        <SelectValue placeholder="Select default view" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dashboard">Dashboard</SelectItem>
                        <SelectItem value="reports">Reports</SelectItem>
                        <SelectItem value="analysis">Analysis</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="flex items-center justify-between py-2">
                    <div>
                      <div className="font-medium">Compact Mode</div>
                      <div className="text-sm text-muted-foreground">Use compact layouts for denser information display</div>
                    </div>
                    <Switch />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button 
                    variant="primary" 
                    iconLeft={<Save className="h-4 w-4" />}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
