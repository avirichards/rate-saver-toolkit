-- Fix the missing foreign key relationship for shipping_analyses table
ALTER TABLE public.shipping_analyses 
ADD CONSTRAINT shipping_analyses_client_id_fkey 
FOREIGN KEY (client_id) REFERENCES public.clients(id);