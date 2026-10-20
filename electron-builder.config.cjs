const config=structuredClone(require('./package.json').build);
const certificate=!!(process.env.WIN_CSC_LINK||process.env.CSC_LINK),azure=!!process.env.AZURE_CLIENT_SECRET;
config.win.signExecutable=certificate||azure;
config.win.forceCodeSigning=certificate||azure;
if(azure){for(const key of ['WIN_PUBLISHER_NAME','AZURE_SIGN_ENDPOINT','AZURE_SIGN_ACCOUNT','AZURE_SIGN_PROFILE','AZURE_TENANT_ID','AZURE_CLIENT_ID'])if(!process.env[key])throw new Error('Die Azure-Herausgebersignatur ist noch nicht vollständig konfiguriert.');config.win.azureSignOptions={publisherName:process.env.WIN_PUBLISHER_NAME,endpoint:process.env.AZURE_SIGN_ENDPOINT,codeSigningAccountName:process.env.AZURE_SIGN_ACCOUNT,certificateProfileName:process.env.AZURE_SIGN_PROFILE};}
else if(certificate&&process.env.WIN_PUBLISHER_NAME)config.win.signtoolOptions={publisherName:process.env.WIN_PUBLISHER_NAME,signingHashAlgorithms:['sha256']};
module.exports=config;
