import {createClient} from 'npm:@supabase/supabase-js@2.118.0';
import {makeHandler} from './handler.mjs';
Deno.serve(makeHandler(createClient,key=>Deno.env.get(key)));
