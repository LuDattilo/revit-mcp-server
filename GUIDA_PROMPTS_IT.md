# Guida Rapida ai Prompt — Revit MCP per Claude Desktop

Raccolta di prompt pronti all'uso per interagire con Revit tramite Claude Desktop.  
Copia e incolla il prompt nella chat, adattando i valori evidenziati in `MAIUSCOLO`.

---

## Indice

- [Informazioni sul Modello](#1-informazioni-sul-modello)
- [Creazione Elementi](#2-creazione-elementi)
- [Modifica Elementi](#3-modifica-elementi)
- [Operazioni Massive](#4-operazioni-massive)
- [Viste e Tavole](#5-viste-e-tavole)
- [Visualizzazione](#6-visualizzazione)
- [Parametri e Proprietà](#7-parametri-e-proprietà)
- [Qualità e Audit](#8-qualità-e-audit)
- [Organizzazione e Collaborazione](#9-organizzazione-e-collaborazione)
- [Avanzato](#10-avanzato)
- [Flussi di Lavoro Completi](#flussi-di-lavoro-completi)

---

## 1. Informazioni sul Modello

### Panoramica progetto
```
Dammi una panoramica del progetto: livelli, fasi, workset e link.
```

### Vista corrente
```
Che vista sto guardando? Mostrami tipo, scala e impostazioni di crop.
```

### Elementi nella vista corrente
```
Elenca tutti gli elementi visibili nella vista corrente.
```

### Elementi selezionati
```
Cosa ho selezionato in Revit? Mostrami gli ID degli elementi selezionati.
```

### Famiglie e tipi disponibili
```
Mostrami tutte le famiglie e i tipi caricati nel progetto.
```
```
Mostrami tutti i tipi di porta disponibili nel progetto.
```
```
Mostrami tutti i tipi di pilastro strutturale disponibili.
```

### Parametri di un elemento
```
Mostrami tutti i parametri dell'elemento con ID NUMERO_ID.
```
```
Quali parametri ha la parete con ID NUMERO_ID?
```

### Statistiche del modello
```
Quanti elementi ci sono in questo modello? Dammi le statistiche per categoria.
```
```
Quanto è complesso questo modello? Analizza gli elementi per categoria, tipo e livello.
```

### Dati locali
```
Esporta tutti i dati dei locali: nome, numero, area, volume.
```

### Quantità materiali
```
Calcola le quantità di materiale per le pareti del progetto.
```
```
Calcola le quantità di materiale per solai e pareti.
```

### Esporta elementi per categoria
```
Esporta tutte le porte con i parametri: Contrassegno, Livello, Larghezza, Altezza.
```
```
Esporta tutti i pilastri con i parametri: Contrassegno, Livello, Tipo.
```
```
Esporta tutte le finestre con i parametri: Contrassegno, Livello, Larghezza, Altezza.
```

### Elementi in un volume spaziale
```
Cosa c'è nel locale 101? Elenca tutti gli elementi al suo interno.
```
```
Quali arredi si trovano nel locale NOME_LOCALE?
```

---

## 2. Creazione Elementi

### Porta o finestra (elemento puntuale)
```
Posiziona una porta di tipo "NOME_TIPO" alle coordinate X=VALORE, Y=VALORE sul livello "NOME_LIVELLO".
```

### Parete (elemento lineare)
```
Crea una parete di tipo "NOME_TIPO" dal punto (X1, Y1) al punto (X2, Y2) sul livello "NOME_LIVELLO".
```

### Solaio (elemento su superficie)
```
Crea un solaio di tipo "NOME_TIPO" con i seguenti punti di contorno: (X1,Y1), (X2,Y2), (X3,Y3), (X4,Y4) sul livello "NOME_LIVELLO".
```

### Solaio dai contorni dei locali
```
Crea i solai per tutti i locali del Livello 1 usando il tipo "NOME_TIPO".
```

### Locale
```
Crea un locale chiamato "NOME" con numero "NUMERO" nel punto (X, Y) del livello "NOME_LIVELLO".
```
```
Inserisci i locali in tutti gli spazi chiusi del Livello 1.
```

### Griglia strutturale
```
Crea una griglia strutturale 6x4 con interasse di 7200mm, partendo dall'origine.
```
```
Crea assi verticali A-F e orizzontali 1-4 con interasse 6000mm.
```

### Livelli
```
Crea i livelli a queste quote: 0, 3000, 6000, 9000mm. Genera automaticamente le piante.
```

### Sistema di travi
```
Crea un sistema di travi con trave tipo "NOME_TRAVE" a interasse 1200mm tra i punti (X1,Y1) e (X2,Y2).
```

---

## 3. Modifica Elementi

### Cambia parametri
```
Imposta il parametro "Commenti" a "Verificato" sull'elemento ID NUMERO_ID.
```
```
Imposta il parametro "Contrassegno" a "D-001" sull'elemento ID NUMERO_ID.
```

### Sposta elemento
```
Sposta l'elemento ID NUMERO_ID di 1000mm in direzione X.
```
```
Sposta l'elemento ID NUMERO_ID di DELTA_X in X, DELTA_Y in Y, DELTA_Z in Z.
```

### Ruota elemento
```
Ruota l'elemento ID NUMERO_ID di 90 gradi attorno al suo centro.
```

### Copia elemento
```
Copia l'elemento ID NUMERO_ID offset (1000, 0, 0).
```

### Elimina elemento
```
Elimina gli elementi con ID NUMERO_ID1, NUMERO_ID2.
```

### Cambia tipo
```
Cambia tutti gli elementi di tipo "TIPO_VECCHIO" al tipo "TIPO_NUOVO" nella categoria Porte.
```

### Operazioni su elementi (selezione, nascondi, isola, colora)
```
Isola tutti i pilastri strutturali nella vista corrente.
```
```
Nascondi tutti gli elementi della categoria Arredi nella vista corrente.
```
```
Seleziona tutti gli elementi con ID NUMERO_ID1, NUMERO_ID2.
```

### Sostituisci grafica
```
Colora l'elemento ID NUMERO_ID in rosso con 50% di trasparenza.
```
```
Metti in mezzatinta l'elemento ID NUMERO_ID nella vista corrente.
```

### Array
```
Crea un array lineare di 5 copie dell'elemento ID NUMERO_ID con passo 2000mm in direzione X.
```
```
Crea un array radiale di 8 copie dell'elemento ID NUMERO_ID con raggio 3000mm.
```

### Copia tra viste
```
Copia le quote dalla vista "NOME_VISTA_ORIGINE" alla vista "NOME_VISTA_DESTINAZIONE".
```

### Abbina proprietà
```
Copia le proprietà dall'elemento ID NUMERO_ORIGINE agli elementi ID NUMERO_ID1, NUMERO_ID2, NUMERO_ID3.
```

---

## 4. Operazioni Massive

### Modifica parametri in batch
```
Aggiungi il prefisso "REV-" al parametro Contrassegno di tutte le porte.
```
```
Imposta il parametro "Stato Revisione" a "Da verificare" su tutti i locali.
```
```
Aggiungi il suffisso "-A" al parametro Contrassegno di tutte le finestre sul Livello 1.
```
```
Sostituisci "Bozza" con "Definitivo" nel parametro Commenti di tutti i pilastri.
```
```
Svuota il parametro Commenti di tutte le pareti.
```

### Sincronizza dati da CSV
```
Aggiorna i parametri di questi elementi con i seguenti dati:
ID 12345: Contrassegno=D-001, Commenti=Verificato
ID 12346: Contrassegno=D-002, Commenti=Da rivedere
```

### Trasferisci parametri
```
Copia i parametri Contrassegno e Commenti dall'elemento ID NUMERO_ORIGINE agli elementi ID NUMERO_ID1, NUMERO_ID2.
```

### Rinomina in batch
```
Rinomina tutte le viste sostituendo "Bozza" con "Definitivo".
```
```
Rinomina tutti i fogli sostituendo "v1" con "v2".
```

### Rinumerazione sequenziale
```
Rinumera tutti i locali da sinistra a destra, dall'alto in basso.
```
```
Rinumera tutte le porte in sequenza per livello.
```

### Epura elementi inutilizzati
```
Mostrami cosa può essere epurato senza eliminare nulla (dry run).
```
```
Epura famiglie, tipi e materiali non utilizzati dal progetto.
```

---

## 5. Viste e Tavole

### Crea viste
```
Crea una pianta al Livello 2.
```
```
Crea una sezione longitudinale tra i punti (X1,Y1) e (X2,Y2).
```
```
Crea un prospetto Est del modello.
```
```
Crea una vista 3D del piano terra.
```

### Crea tavola
```
Crea la tavola A101 con cartiglio "NOME_CARTIGLIO" e titolo "Pianta Piano Terra".
```

### Inserisci vista in tavola
```
Inserisci la pianta del Livello 1 nella tavola A101.
```

### Crea abaco
```
Crea un abaco porte con i campi: Contrassegno, Livello, Larghezza, Altezza, Tipo.
```
```
Crea un abaco locali con i campi: Numero, Nome, Area, Volume, Livello.
```
```
Crea un abaco pilastri con i campi: Contrassegno, Livello, Tipo, Materiale.
```

### Quotature
```
Quota la distanza tra le pareti con ID NUMERO_ID1, NUMERO_ID2 nella vista corrente.
```

### Note di testo
```
Aggiungi una nota "Verificare in cantiere" nel punto (X, Y) della vista corrente.
```

### Regione riempita
```
Crea una regione riempita con colore rosso nella zona delimitata dai punti (X1,Y1), (X2,Y2), (X3,Y3), (X4,Y4).
```

### Revisioni
```
Aggiungi la revisione "Aggiornamento pianta" alla tavola A101.
```

### Duplica vista
```
Duplica la vista corrente con tutti i dettagli.
```

### Filtri di vista
```
Crea un filtro per nascondere tutti gli arredi nella vista corrente.
```
```
Crea un filtro che mostra in rosso le pareti con parametro "Stato" = "Da rivedere".
```

### Template di vista
```
Applica il template "Pianta Architettonica" a tutte le piante del progetto.
```
```
Quali template di vista sono disponibili nel progetto?
```

### Viste da locali
```
Crea viste di sezione per tutti i locali del Livello 1.
```

### Tavole in batch
```
Crea le tavole A201, A202, A203, A204, A205 con cartiglio "NOME_CARTIGLIO".
```

### Duplica tavola con contenuto
```
Duplica la tavola A101 chiamandola A101-Rev2 con tutte le viste.
```

### Allinea finestre di vista
```
Allinea tutte le finestre di vista sulle tavole in modo che corrispondano all'allineamento di A101.
```

### Modifica range di vista in batch
```
Imposta il piano di taglio a 1200mm su tutte le piante del progetto.
```

### Section box da selezione
```
Crea un section box 3D attorno agli elementi selezionati.
```
```
Crea un section box 3D attorno agli elementi con ID NUMERO_ID1, NUMERO_ID2.
```

### Esporta
```
Esporta tutti i fogli in PDF.
```
```
Esporta tutte le piante in DWG.
```
```
Esporta il modello in formato IFC.
```

### Esporta abaco
```
Esporta l'abaco porte in CSV.
```

---

## 6. Visualizzazione

### Colora elementi per parametro
```
Colora i locali per dipartimento.
```
```
Colora le pareti in base al parametro "Tipo struttura".
```

### Colora con legenda
```
Crea una vista colorata dei locali per dipartimento con legenda.
```

### Taga locali
```
Taga tutti i locali nella vista corrente.
```

### Taga pareti
```
Taga tutte le pareti nella vista corrente.
```

---

## 7. Parametri e Proprietà

### Gestisci parametri di progetto
```
Elenca tutti i parametri di progetto.
```
```
Crea un parametro di testo "Stato Revisione" applicato alla categoria Pareti.
```
```
Crea un parametro numerico "Costo Unitario" applicato alla categoria Porte.
```
```
Elimina il parametro "NOME_PARAMETRO" dal progetto.
```

### Parametri condivisi
```
Quali parametri condivisi sono disponibili nel progetto?
```

### Aggiungi parametro condiviso
```
Aggiungi il parametro condiviso "Classe Fuoco" dal file "PERCORSO_FILE.txt" alla categoria Porte.
```

---

## 8. Qualità e Audit

### Salute del modello
```
Controlla la salute di questo modello e dammi un voto.
```

### Audit famiglie
```
Verifica la salute di tutte le famiglie: individua quelle inutilizzate e quelle problematiche.
```

### Warning Revit
```
Mostrami tutti i warning del modello.
```
```
Mostrami solo i warning critici del modello.
```
```
Mostrami i warning di categoria "Elementi sovrapposti".
```

### Rilevamento interferenze
```
Controlla le interferenze tra pareti e tubazioni.
```
```
Controlla le interferenze tra travi e condotti HVAC.
```
```
Controlla le interferenze tra elementi strutturali e impianti.
```

### Pulizia importazioni CAD
```
Ci sono importazioni CAD da rimuovere o sistemare?
```

### Misura distanza
```
Misura la distanza tra l'elemento ID NUMERO_ID1 e l'elemento ID NUMERO_ID2.
```

---

## 9. Organizzazione e Collaborazione

### Workset
```
Quali workset sono disponibili nel progetto?
```
```
Sposta gli elementi con ID NUMERO_ID1, NUMERO_ID2 nel workset "MEP".
```

### Fasi
```
Quali fasi esistono nel progetto?
```
```
Assegna gli elementi con ID NUMERO_ID1, NUMERO_ID2 alla fase "Nuova Costruzione".
```

### Materiali
```
Elenca tutti i materiali del progetto.
```
```
Mostrami le proprietà del materiale "Calcestruzzo".
```

### Famiglie
```
Carica la famiglia dal file "C:/Famiglie/MiaPorta.rfa".
```
```
Elenca tutte le famiglie caricate nel progetto.
```

### Link Revit
```
Elenca tutti i modelli collegati (link Revit).
```
```
Ricarica tutti i link Revit.
```

---

## 10. Avanzato

### Filtro avanzato elementi
```
Trova tutte le porte al Livello 1 con larghezza maggiore di 900mm.
```
```
Trova tutti i locali con area maggiore di 50 mq sul Livello 2.
```
```
Trova tutte le pareti di tipo "NOME_TIPO" con altezza maggiore di 3000mm.
```
```
Trova tutti i pilastri sul Livello 1 con il parametro "Stato" uguale a "Da verificare".
```

### Esegui codice C# personalizzato
```
Esegui questo codice Revit API:
var walls = new FilteredElementCollector(document)
    .OfClass(typeof(Wall))
    .Cast<Wall>()
    .Where(w => w.LevelId != ElementId.InvalidElementId)
    .ToList();
return $"Trovate {walls.Count} pareti nel modello";
```

---

## Flussi di Lavoro Completi

### Audit e Pulizia Modello
```
1. Controlla la salute di questo modello e dammi un voto.
2. Mostrami tutti i warning del modello.
3. Verifica la salute di tutte le famiglie.
4. Mostrami cosa può essere epurato senza eliminare nulla.
5. Ci sono importazioni CAD da rimuovere?
6. Epura famiglie, tipi e materiali non utilizzati.
```

### Documentazione Locali
```
1. Esporta tutti i dati dei locali con area, volume e contorni.
2. Crea viste di sezione per tutti i locali del Livello 1.
3. Taga tutti i locali nella vista corrente.
4. Crea una vista colorata dei locali per dipartimento con legenda.
5. Crea un abaco locali con i campi: Numero, Nome, Area, Volume, Livello.
```

### Creazione Set Tavole
```
1. Crea le tavole A101, A102, A103, A104, A105 con cartiglio "NOME_CARTIGLIO".
2. Inserisci le piante dei livelli nelle rispettive tavole.
3. Allinea tutte le finestre di vista sulle tavole.
4. Aggiungi la revisione "Prima emissione" a tutte le tavole.
5. Esporta tutti i fogli in PDF.
```

### Gestione Dati e Numerazione
```
1. Esporta tutte le porte con i parametri: Contrassegno, Livello, Tipo.
2. Aggiorna i contrassegni porte con i nuovi valori.
3. Aggiungi il prefisso "D-" a tutti i contrassegni porte.
4. Rinumera tutte le porte in sequenza per livello.
```

### Coordinamento e Interferenze
```
1. Controlla le interferenze tra travi e condotti HVAC.
2. Isola gli elementi in conflitto nella vista corrente.
3. Crea un section box 3D attorno agli elementi selezionati.
4. Misura la distanza tra i due elementi in conflitto.
```

### Gestione Parametri
```
1. Elenca tutti i parametri di progetto.
2. Crea un parametro di testo "Stato Revisione" applicato alla categoria Pareti.
3. Imposta il parametro "Stato Revisione" a "Da verificare" su tutte le pareti.
4. Esporta tutte le pareti con il parametro Stato Revisione.
```

---

## Note Utili

- **Coordinate**: Tutte in millimetri salvo indicazione contraria
- **ID elemento**: Usa `Cosa ho selezionato?` o `Elenca gli elementi nella vista corrente` per trovare gli ID
- **Nomi parametri**: Dipendono dalla lingua di Revit (es. "Commenti" in italiano, "Comments" in inglese)
- **Nomi tipi**: Usa `Mostrami tutte le famiglie disponibili` per avere i nomi esatti
- **Dry run**: Per operazioni massive, aggiungi "senza applicare le modifiche" per una preview
- **Selezione**: Seleziona elementi in Revit e poi scrivi `Cosa ho selezionato?` per ottenere gli ID
