import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Percent, Plus, Edit, Trash2, Star } from 'lucide-react';
import { useMarkupProfiles, useCreateMarkupProfile, type MarkupProfile } from '@/hooks/useMarkupProfiles';

interface MarkupFormData {
  name: string;
  description: string;
  markup_type: 'global' | 'per_service' | 'tiered';
  global_percentage: string;
  is_default: boolean;
}

const initialFormData: MarkupFormData = {
  name: '',
  description: '',
  markup_type: 'global',
  global_percentage: '',
  is_default: false
};

export const MarkupManager: React.FC = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MarkupFormData>(initialFormData);

  const { data: profiles = [], isLoading } = useMarkupProfiles();
  const createProfile = useCreateMarkupProfile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const markup_config = {
        global_percentage: parseFloat(formData.global_percentage) || 0
      };

      await createProfile.mutateAsync({
        name: formData.name,
        description: formData.description,
        markup_type: formData.markup_type,
        markup_config,
        is_default: formData.is_default
      });
      
      setIsDialogOpen(false);
      setFormData(initialFormData);
    } catch (error) {
      console.error('Error saving markup profile:', error);
    }
  };

  const resetForm = () => {
    setFormData(initialFormData);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading markup profiles...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Markup Profiles</h2>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Markup Profile
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Markup Profile</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Profile Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Standard 15%"
                  required
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={2}
                />
              </div>
              
              <div>
                <Label htmlFor="markup_type">Markup Type</Label>
                <Select value={formData.markup_type} onValueChange={(value: any) => setFormData({ ...formData, markup_type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="global">Global Percentage</SelectItem>
                    <SelectItem value="per_service">Per Service</SelectItem>
                    <SelectItem value="tiered">Tiered Rates</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.markup_type === 'global' && (
                <div>
                  <Label htmlFor="global_percentage">Global Markup Percentage</Label>
                  <Input
                    id="global_percentage"
                    type="number"
                    step="0.1"
                    value={formData.global_percentage}
                    onChange={(e) => setFormData({ ...formData, global_percentage: e.target.value })}
                    placeholder="15.0"
                  />
                </div>
              )}
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                />
                <Label htmlFor="is_default">Set as default profile</Label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={createProfile.isPending}>
                  Create Profile
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <Card key={profile.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                  {profile.is_default && (
                    <Star className="h-4 w-4 text-yellow-500 fill-current" />
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Badge variant="secondary" className="w-fit capitalize">
                {profile.markup_type.replace('_', ' ')}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {profile.description && (
                <p className="text-sm text-muted-foreground">{profile.description}</p>
              )}
              
              {profile.markup_type === 'global' && profile.markup_config.global_percentage && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {profile.markup_config.global_percentage}% markup
                  </Badge>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground">
                Created {new Date(profile.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {profiles.length === 0 && (
        <div className="text-center py-12">
          <Percent className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground">No markup profiles yet</h3>
          <p className="text-sm text-muted-foreground">Create your first markup profile to get started</p>
        </div>
      )}
    </div>
  );
};