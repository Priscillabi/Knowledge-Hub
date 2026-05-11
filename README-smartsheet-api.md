# API Smartsheet per Vercel

Questa API espone solo dati provenienti dal workspace Smartsheet configurato in Vercel.

## File creato

```text
api/smartsheet.js
```

Su Vercel diventa disponibile come:

```text
/api/smartsheet
```

## Variabili ambiente da configurare su Vercel

Vai nel progetto Vercel, poi:

```text
Settings > Environment Variables
```

Aggiungi:

```text
SMARTSHEET_ACCESS_TOKEN
```

Token API personale di Smartsheet. Non inserirlo nel codice e non caricarlo su GitHub.

```text
SMARTSHEET_WORKSPACE_ID
```

ID numerico del solo workspace Smartsheet autorizzato.

Opzionale:

```text
SMARTSHEET_SHEET_ID
```

ID numerico del foglio da leggere. Se lo configuri, ha priorita rispetto al nome del foglio.

Opzionale:

```text
SMARTSHEET_SHEET_NAME
```

Nome del foglio da leggere dentro il workspace. Se non configurata, l'API cerca:

```text
Knowledge Hub
```

Opzionale:

```text
SMARTSHEET_BASE_URL
```

Valore predefinito:

```text
https://api.smartsheet.com/2.0
```

Per account Smartsheet EU, usa:

```text
https://api.smartsheet.eu/2.0
```

## Come usare l'API

Lettura del foglio `Knowledge Hub` dentro il workspace configurato:

```text
https://TUO-SITO.vercel.app/api/smartsheet
```

## Allegati

L'API legge anche gli allegati associati alle righe Smartsheet usando `include=attachments`.

Il frontend non riceve il token Smartsheet. Quando l'utente clicca `Apri allegato`, il sito chiama:

```text
/api/attachment?attachmentId=ID_ALLEGATO
```

Questo endpoint backend chiede a Smartsheet un URL temporaneo tramite:

```text
/sheets/{sheetId}/attachments/{attachmentId}
```

Non servono variabili ambiente aggiuntive per gli allegati, ma il token deve avere permessi di lettura sul foglio e sugli allegati.

Nota: gli URL degli allegati Smartsheet possono essere temporanei o richiedere autenticazione Smartsheet.
