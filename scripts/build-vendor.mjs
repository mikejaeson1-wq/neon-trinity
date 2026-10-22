import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
await mkdir(new URL('../app/vendor/',import.meta.url),{recursive:true});
await build({stdin:{contents:"export {createClient} from '@supabase/supabase-js';",resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',outfile:fileURLToPath(new URL('../app/vendor/supabase.mjs',import.meta.url))});
await build({stdin:{contents:"export {Mp3Encoder} from '@breezystack/lamejs';",resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',outfile:fileURLToPath(new URL('../app/vendor/mp3-encoder.mjs',import.meta.url))});
const {copyFile}=await import('node:fs/promises');
await copyFile(new URL('../node_modules/@breezystack/lamejs/LICENSE',import.meta.url),new URL('../app/vendor/mp3-encoder.LICENSE',import.meta.url));

await build({stdin:{contents:"export {toString} from 'qrcode';",resolveDir:fileURLToPath(new URL('..',import.meta.url))},bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,legalComments:'linked',outfile:fileURLToPath(new URL('../app/vendor/qr.mjs',import.meta.url))});

await copyFile(new URL('../node_modules/qrcode/license',import.meta.url),new URL('../app/vendor/qrcode.LICENSE',import.meta.url));
