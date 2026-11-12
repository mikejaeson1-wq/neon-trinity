async function writeClipboardText(clipboard,text){
 if(typeof text!=='string'||!text||text.length>65536||text.includes('\0'))throw new Error('Ungültiger Text zum Kopieren.');
 await clipboard.writeText(text);
 return true;
}
module.exports={writeClipboardText};
