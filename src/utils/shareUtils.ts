import { supabase } from '@/integrations/supabase/client';

export interface ShareData {
  shareToken: string;
  analysisId: string;
  clientId?: string;
  expiresAt?: string;
  isActive: boolean;
}

// Generate a secure random token for sharing
export const generateShareToken = (): string => {
  return crypto.randomUUID().replace(/-/g, '');
};

// Create a new share link for an analysis
export const createReportShare = async (analysisId: string, clientId?: string, expiresAt?: Date): Promise<ShareData | null> => {
  try {
    const shareToken = generateShareToken();
    
    const shareData = {
      analysis_id: analysisId,
      share_token: shareToken,
      client_id: clientId || null,
      expires_at: expiresAt?.toISOString() || null,
      is_active: true,
      view_count: 0
    };

    const { data, error } = await supabase
      .from('report_shares')
      .insert(shareData)
      .select()
      .single();

    if (error) throw error;

    return {
      shareToken,
      analysisId,
      clientId,
      expiresAt: expiresAt?.toISOString(),
      isActive: true
    };
  } catch (error) {
    console.error('Error creating share:', error);
    return null;
  }
};

// Get existing share for an analysis or create new one
export const getOrCreateReportShare = async (analysisId: string, clientId?: string): Promise<ShareData | null> => {
  try {
    // Check if share already exists
    const { data: existingShare, error: queryError } = await supabase
      .from('report_shares')
      .select('*')
      .eq('analysis_id', analysisId)
      .eq('is_active', true)
      .maybeSingle();

    if (queryError) throw queryError;

    if (existingShare) {
      return {
        shareToken: existingShare.share_token,
        analysisId: existingShare.analysis_id,
        clientId: existingShare.client_id,
        expiresAt: existingShare.expires_at,
        isActive: existingShare.is_active
      };
    }

    // Create new share if none exists
    return await createReportShare(analysisId, clientId);
  } catch (error) {
    console.error('Error getting or creating share:', error);
    return null;
  }
};

// Get shared report data using share token
export const getSharedReport = async (shareToken: string) => {
  try {
    const { data: share, error: shareError } = await supabase
      .from('report_shares')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .maybeSingle();

    if (shareError) throw shareError;

    if (!share) {
      throw new Error('Share not found or inactive');
    }

    // Check if share has expired
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      throw new Error('Share has expired');
    }

    // Now get the analysis data
    const { data: analysis, error: analysisError } = await supabase
      .from('shipping_analyses')
      .select(`
        *,
        clients (
          id,
          company_name,
          branding_config
        )
      `)
      .eq('id', share.analysis_id)
      .single();

    if (analysisError) throw analysisError;

    return {
      ...share,
      shipping_analyses: analysis
    };
  } catch (error) {
    console.error('Error fetching shared report:', error);
    throw error;
  }
};

// Update view count for a shared report
export const updateViewCount = async (shareToken: string): Promise<void> => {
  try {
    const { error } = await supabase
      .from('report_shares')
      .update({
        last_viewed_at: new Date().toISOString()
      })
      .eq('share_token', shareToken);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating view count:', error);
  }
};

// Copy share URL to clipboard
export const copyShareUrl = async (shareToken: string): Promise<boolean> => {
  try {
    const url = `${window.location.origin}/share/${shareToken}`;
    await navigator.clipboard.writeText(url);
    return true;
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
};

// Get share URL
export const getShareUrl = (shareToken: string): string => {
  return `${window.location.origin}/share/${shareToken}`;
};

// Deactivate a share
export const deactivateShare = async (analysisId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('report_shares')
      .update({ is_active: false })
      .eq('analysis_id', analysisId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deactivating share:', error);
    return false;
  }
};