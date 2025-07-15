import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface MarkupProfile {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  markup_type: string;
  markup_config: any;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export const useMarkupProfiles = () => {
  return useQuery({
    queryKey: ['markup-profiles'],
    queryFn: async (): Promise<MarkupProfile[]> => {
      const { data, error } = await supabase
        .from('markup_profiles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data || [];
    }
  });
};

export const useCreateMarkupProfile = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (profileData: Omit<MarkupProfile, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('markup_profiles')
        .insert([{ ...profileData, user_id: user.id }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['markup-profiles'] });
      toast({
        title: "Markup Profile Created",
        description: "Markup profile has been successfully created.",
      });
    }
  });
};

export const applyMarkup = (baseRate: number, profile: MarkupProfile, serviceCode?: string): number => {
  if (!profile) return baseRate;

  switch (profile.markup_type) {
    case 'global':
      const globalPercentage = profile.markup_config.global_percentage || 0;
      return baseRate * (1 + globalPercentage / 100);

    case 'per_service':
      if (!serviceCode || !profile.markup_config.service_markups) return baseRate;
      const servicePercentage = profile.markup_config.service_markups[serviceCode] || 0;
      return baseRate * (1 + servicePercentage / 100);

    case 'tiered':
      if (!profile.markup_config.tiers) return baseRate;
      const tier = profile.markup_config.tiers.find(
        t => baseRate >= t.min_amount && (t.max_amount === -1 || baseRate <= t.max_amount)
      );
      if (!tier) return baseRate;
      return baseRate * (1 + tier.percentage / 100);

    default:
      return baseRate;
  }
};

export const calculateSavingsWithMarkup = (
  currentRate: number,
  shippingRate: number,
  markupProfile?: MarkupProfile,
  serviceCode?: string
): { finalRate: number; savings: number; savingsPercentage: number } => {
  const finalRate = markupProfile ? applyMarkup(shippingRate, markupProfile, serviceCode) : shippingRate;
  const savings = currentRate - finalRate;
  const savingsPercentage = currentRate > 0 ? (savings / currentRate) * 100 : 0;

  return {
    finalRate,
    savings,
    savingsPercentage
  };
};