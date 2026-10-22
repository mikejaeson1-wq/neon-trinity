import {createHash} from 'node:crypto';
// A Windows checkout may use CRLF for source text. PNGs and all other binary
// inputs must retain byte-exact hashes; source edits still invalidate the APK.
export function sourceHash(name,input){const bytes=/\.(java|xml|py)$/i.test(name)?Buffer.from(Buffer.from(input).toString('utf8').replace(/\r\n/g,'\n')):input;return createHash('sha256').update(bytes).digest('hex');}
