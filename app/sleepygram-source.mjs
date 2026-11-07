export function canShareToSleepygram({kind,record,user,band}){
 if(!user?.id||!['Dex','Nix','Jax'].includes(user.alias)||!record||record.visibility==='shared')return false;
 return kind==='album'?!!band:!!band||record.ownerId===user.id;
}
export function sleepygramChoices({kind,record,user,band,getBlob}){
 if(!canShareToSleepygram({kind,record,user,band}))throw new Error('Du kannst eigene Dateien und Inhalte der Band auf Sleepygram teilen.');
 const choices=[];
 if(kind==='track'&&record.blobId)choices.push({label:'Song: '+record.title,name:(record.title||'Song')+'.mp3',getBlob:()=>getBlob(record.blobId)});
 if(record.coverBlobId)choices.push({label:'Cover: '+record.title,name:(record.title||'Cover')+'-Cover',getBlob:()=>getBlob(record.coverBlobId)});
 return choices;
}
