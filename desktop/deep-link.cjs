function listeningRoomFromURL(input){
  try{if(typeof input!=='string'||input.length>160)return null;const u=new URL(input);if(u.protocol!=='neontrinity:'||u.hostname!=='listen'||u.username||u.password||u.port||u.hash||u.search)return null;const room=u.pathname.slice(1);return /^[a-f0-9]{64}$/.test(room)?room:null;}catch{return null;}
}
const roomFromArguments=args=>Array.isArray(args)?args.map(listeningRoomFromURL).find(Boolean)||null:null;
module.exports={listeningRoomFromURL,roomFromArguments};
