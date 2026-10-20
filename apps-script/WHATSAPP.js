function desuscribirApp() {
  const WABA_ID = '409991278864660';
  const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('WHATSAPP_TOKEN');
  const res = UrlFetchApp.fetch(
    `https://graph.facebook.com/v25.0/${WABA_ID}/subscribed_apps`,
    { method: 'delete', headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }, muteHttpExceptions: true });
  Logger.log(res.getContentText());
}




function diagnostico() {
  const WABA_ID = '409991278864660';
  const PHONE_NUMBER_ID = '1334327689753779';
  const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('WHATSAPP_TOKEN');
  const opt = { headers: { Authorization: 'Bearer ' + ACCESS_TOKEN }, muteHttpExceptions: true };

  const apps = UrlFetchApp.fetch(
    `https://graph.facebook.com/v25.0/${WABA_ID}/subscribed_apps`, opt);
  Logger.log('APPS SUSCRITAS: ' + apps.getContentText());

  const num = UrlFetchApp.fetch(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}?fields=display_phone_number,status,code_verification_status,platform_type,name_status`, opt);
  Logger.log('NUMERO: ' + num.getContentText());
}




function liberarNumero() {
  const PHONE_NUMBER_ID = '1334327689753779';
  const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('WHATSAPP_TOKEN');

  const res = UrlFetchApp.fetch(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/deregister`,
    {
      method: 'post',
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN },
      muteHttpExceptions: true
    }
  );
  Logger.log(res.getResponseCode());
  Logger.log(res.getContentText());
}


function registrarNumero() {
  const PHONE_NUMBER_ID = '1334327689753779';
  const ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('WHATSAPP_TOKEN');
  const PIN = '310189';

  const res = UrlFetchApp.fetch(
    `https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/register`,
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + ACCESS_TOKEN },
      payload: JSON.stringify({ messaging_product: 'whatsapp', pin: PIN }),
      muteHttpExceptions: true
    }
  );
  Logger.log(res.getResponseCode());
  Logger.log(res.getContentText());
}
