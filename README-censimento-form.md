# Mapping modulo "Censimento informazione"

Fonte di verita: `form-reference/logica_compilazione_modulo_censimento_informazione.md`.

- Sezione 2: `CENSIMENTO_INFO_TYPES` e `renderInfoTypeField()` in `app.js`.
- Sezione 3: `renderWorkaroundField()` e reset progressivo in `bindEntryFormEvents()`.
- Sezione 4: `CENSIMENTO_TOOLS`, `TOOL_VALUE_ALIASES` e `renderToolField()`.
- Sezioni 5.1-5.6 e Sezione 10: `FUNCTIONALITY_CONFIG`, `renderFunctionalitySections()`, `renderFunctionalitySection()` e `hasCodeTrigger()`.
- Sezione 6: `renderDetailSection()` e validazione obbligatoria dinamica in `validateEntryPayload()`; il campo file resta opzionale.
- Sezione 7: pulsante `Invia` in `index.html`; la funzionalita di copia risposte e stata rimossa.
- Submission: `entryPayloadFromForm()` in `app.js` e `api/smartsheet-create.js`.

Nota: il campo web aggiuntivo `Titolo Iniziativa` resta obbligatorio e viene scritto nella colonna Smartsheet `Titolo Informazione` quando `Titolo Iniziativa` non esiste nel foglio.
