import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
await mkdir(new URL('../app/vendor/',import.meta.url),{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:new URL('..',import.meta.url).pathname},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',outfile:new URL('../app/vendor/supabase.mjs',import.meta.url).pathname});
