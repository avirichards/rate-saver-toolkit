-- Add service_notes table to store user notes for each service type in an analysis
CREATE TABLE public.service_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  analysis_id UUID NOT NULL,
  service_name TEXT NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE(analysis_id, service_name)
);

-- Enable Row Level Security
ALTER TABLE public.service_notes ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own service notes" 
ON public.service_notes 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own service notes" 
ON public.service_notes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own service notes" 
ON public.service_notes 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own service notes" 
ON public.service_notes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_service_notes_updated_at
BEFORE UPDATE ON public.service_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();