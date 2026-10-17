import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
await mkdir(new URL('../app/vendor/',import.meta.url),{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',outfile:fileURLToPath(new URL('../app/vendor/supabase.mjs',import.meta.url))});
