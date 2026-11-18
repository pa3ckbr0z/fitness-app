/* Biblioteka gotovih programa treninga.
   Svaki program ima jedan ili više predložaka (dana) i, gdje ima smisla, prijedlog
   rasporeda po danima u tjednu: [dan u tjednu (0=ned … 6=sub), indeks predloška].
   Vježbe: [ime, broj setova, ponavljanja]. Imena su ista u svim programima, pa
   "prošli put" i progresija rade i kad promijeniš program. */
(function () {
  // Vježbe bez vanjskog opterećenja (težina 0 → progresija dodaje ponavljanja)
  const BW = new Set(['Zgibovi', 'Propadanja (dips)', 'Sklekovi', 'Sklekovi na koljenima', 'Pike sklekovi', 'Inverzno veslanje (stol)',
    'Propadanja na stolici', 'Čučanj s vlastitom težinom', 'Iskoraci unatrag', 'Skokovi iz čučnja', 'Step-up na stolicu', 'Glute bridge',
    'Jednonožni glute bridge', 'Superman', 'Burpees', 'Mountain climbers', 'Jumping jacks', 'Podizanje nogu u visu', 'Trbušnjaci (crunch)',
    'Ruski twist', 'Dead bug', 'Bird dog', 'Mačka-krava', 'Kruženje ramenima', 'Iskorak s rotacijom', 'Otvaranje kukova 90/90', 'Bugarski čučanj (bez utega)']);
  const isBW = (n) => BW.has(n) || /\((s|min|m|broj)\)$/.test(n);

  const T = (name, type, ex, extra = {}) => ({
    name, type,
    exercises: ex.map(([n, s, r]) => ({ name: n, sets: Array.from({ length: s }, () => ({ reps: r, weight: isBW(n) ? 0 : '' })) })),
    ...extra
  });

  const MON = 1, TUE = 2, WED = 3, THU = 4, FRI = 5, SAT = 6, SUN = 0;

  window.PROGRAM_CATS = ['Teretana', 'Snaga', 'Početnici', 'Kod kuće', 'Bučice', 'Mršavljenje', 'Kardio', 'Mobilnost', 'Dijelovi tijela'];

  window.PROGRAMS = [
    /* ================= TERETANA ================= */
    {
      id: 'ppl3', cat: 'Teretana', name: 'Push / Pull / Noge', level: 'Srednji', perWeek: 3,
      desc: 'Najpopularniji split: guranje (prsa, ramena, triceps), vučenje (leđa, biceps) i noge. Svaka mišićna skupina jednom tjedno, puno volumena.',
      schedule: [[MON, 0], [WED, 1], [FRI, 2]],
      templates: [
        T('PPL · Push', 'Snaga', [['Bench press', 4, 6], ['Potisak iznad glave', 3, 8], ['Kosi potisak s bučicama', 3, 10], ['Odručenje s bučicama', 3, 15], ['Triceps na sajli', 3, 12], ['Francuski potisak', 2, 12]]),
        T('PPL · Pull', 'Snaga', [['Mrtvo dizanje', 3, 5], ['Zgibovi', 3, 8], ['Veslanje s šipkom', 3, 8], ['Face pull', 3, 15], ['Biceps pregib', 3, 10], ['Čekić pregib', 2, 12]]),
        T('PPL · Noge', 'Snaga', [['Čučanj', 4, 6], ['Rumunjsko mrtvo dizanje', 3, 8], ['Nožna preša', 3, 12], ['Pregib nogu', 3, 12], ['Podizanje na prste', 4, 15], ['Plank (s)', 3, 45]])
      ]
    },
    {
      id: 'ppl6', cat: 'Teretana', name: 'Push / Pull / Noge ×2', level: 'Napredni', perWeek: 6,
      desc: 'Svaka mišićna skupina dvaput tjedno, s A i B varijantom. Za iskusne koji se dobro oporavljaju.',
      schedule: [[MON, 0], [TUE, 1], [WED, 2], [THU, 3], [FRI, 4], [SAT, 5]],
      templates: [
        T('PPL · Push', 'Snaga', [['Bench press', 4, 6], ['Potisak iznad glave', 3, 8], ['Kosi potisak s bučicama', 3, 10], ['Odručenje s bučicama', 3, 15], ['Triceps na sajli', 3, 12], ['Francuski potisak', 2, 12]]),
        T('PPL · Pull', 'Snaga', [['Mrtvo dizanje', 3, 5], ['Zgibovi', 3, 8], ['Veslanje s šipkom', 3, 8], ['Face pull', 3, 15], ['Biceps pregib', 3, 10], ['Čekić pregib', 2, 12]]),
        T('PPL · Noge', 'Snaga', [['Čučanj', 4, 6], ['Rumunjsko mrtvo dizanje', 3, 8], ['Nožna preša', 3, 12], ['Pregib nogu', 3, 12], ['Podizanje na prste', 4, 15], ['Plank (s)', 3, 45]]),
        T('PPL · Push B', 'Snaga', [['Potisak iznad glave', 4, 6], ['Kosi bench press', 3, 8], ['Propadanja (dips)', 3, 10], ['Razvlačenje na sajli', 3, 12], ['Odručenje s bučicama', 4, 15], ['Triceps iznad glave na sajli', 3, 12]]),
        T('PPL · Pull B', 'Snaga', [['Veslanje s bučicom', 4, 10], ['Lat pulldown', 3, 10], ['Veslanje na sajli sjedeći', 3, 12], ['Face pull', 3, 15], ['Biceps pregib s bučicama', 3, 12], ['Čekić pregib', 3, 12]]),
        T('PPL · Noge B', 'Snaga', [['Bugarski čučanj', 3, 10], ['Hip thrust', 4, 8], ['Ekstenzija nogu', 3, 15], ['Pregib nogu', 3, 12], ['Podizanje na prste', 4, 15], ['Podizanje nogu u visu', 3, 12]])
      ]
    },
    {
      id: 'ul4', cat: 'Teretana', name: 'Gornji / Donji dio', level: 'Srednji', perWeek: 4,
      desc: 'Četiri treninga tjedno: dvaput gornji, dvaput donji dio tijela. Odličan omjer snage i mišićne mase.',
      schedule: [[MON, 0], [TUE, 1], [THU, 2], [FRI, 3]],
      templates: [
        T('Gornji A', 'Snaga', [['Bench press', 4, 6], ['Veslanje s šipkom', 4, 8], ['Potisak iznad glave', 3, 8], ['Lat pulldown', 3, 10], ['Biceps pregib', 2, 12], ['Triceps na sajli', 2, 12]]),
        T('Donji A', 'Snaga', [['Čučanj', 4, 6], ['Rumunjsko mrtvo dizanje', 3, 8], ['Iskoraci', 3, 10], ['Podizanje na prste', 4, 15], ['Plank (s)', 3, 45]]),
        T('Gornji B', 'Snaga', [['Kosi potisak s bučicama', 4, 10], ['Zgibovi', 4, 8], ['Potisak s bučicama sjedeći', 3, 10], ['Veslanje na sajli sjedeći', 3, 12], ['Odručenje s bučicama', 3, 15], ['Čekić pregib', 2, 12]]),
        T('Donji B', 'Snaga', [['Mrtvo dizanje', 3, 5], ['Nožna preša', 3, 12], ['Pregib nogu', 3, 12], ['Hip thrust', 3, 10], ['Podizanje nogu u visu', 3, 12]])
      ]
    },
    {
      id: 'fb3', cat: 'Teretana', name: 'Full body A/B', level: 'Početnik / srednji', perWeek: 3,
      desc: 'Cijelo tijelo na svakom treningu, izmjenjuju se A i B. Idealno ako možeš ići 3× tjedno i želiš brz napredak.',
      schedule: [[MON, 0], [WED, 1], [FRI, 0]],
      templates: [
        T('Full body A', 'Snaga', [['Čučanj', 3, 8], ['Bench press', 3, 8], ['Veslanje s šipkom', 3, 8], ['Odručenje s bučicama', 2, 15], ['Plank (s)', 3, 30]]),
        T('Full body B', 'Snaga', [['Rumunjsko mrtvo dizanje', 3, 8], ['Potisak iznad glave', 3, 8], ['Lat pulldown', 3, 10], ['Iskoraci', 2, 10], ['Podizanje nogu u visu', 2, 12]])
      ]
    },
    {
      id: 'bro5', cat: 'Teretana', name: 'Klasični split (5 dana)', level: 'Srednji', perWeek: 5,
      desc: 'Svaki dan jedna mišićna skupina: prsa, leđa, noge, ramena, ruke. Puno vježbi po skupini i dobra "pumpa".',
      schedule: [[MON, 0], [TUE, 1], [WED, 2], [THU, 3], [FRI, 4]],
      templates: [
        T('Split · Prsa', 'Snaga', [['Bench press', 4, 8], ['Kosi potisak s bučicama', 3, 10], ['Razvlačenje s bučicama', 3, 12], ['Propadanja (dips)', 3, 10], ['Razvlačenje na sajli', 2, 15]]),
        T('Split · Leđa', 'Snaga', [['Mrtvo dizanje', 3, 5], ['Zgibovi', 4, 8], ['Veslanje s šipkom', 3, 10], ['Lat pulldown', 3, 12], ['Veslanje s bučicom', 2, 12]]),
        T('Split · Noge', 'Snaga', [['Čučanj', 4, 8], ['Nožna preša', 3, 12], ['Rumunjsko mrtvo dizanje', 3, 10], ['Ekstenzija nogu', 3, 15], ['Pregib nogu', 3, 12], ['Podizanje na prste', 4, 15]]),
        T('Split · Ramena', 'Snaga', [['Potisak iznad glave', 4, 8], ['Odručenje s bučicama', 4, 15], ['Face pull', 3, 15], ['Potisak s bučicama sjedeći', 3, 10], ['Slijeganje ramenima s bučicama', 3, 15]]),
        T('Split · Ruke', 'Snaga', [['Biceps pregib', 4, 10], ['Francuski potisak', 4, 10], ['Čekić pregib', 3, 12], ['Triceps na sajli', 3, 12], ['Biceps pregib s bučicama', 2, 15], ['Propadanja (dips)', 2, 12]])
      ]
    },

    /* ================= SNAGA ================= */
    {
      id: 's5x5', cat: 'Snaga', name: 'Snaga 5×5', level: 'Početnik / srednji', perWeek: 3,
      desc: 'Klasični program za snagu: malo vježbi, teške težine, 5 setova po 5. Kad odradiš sve setove, sljedeći put +2,5 kg.',
      schedule: [[MON, 0], [WED, 1], [FRI, 0]],
      templates: [
        T('5×5 · A', 'Snaga', [['Čučanj', 5, 5], ['Bench press', 5, 5], ['Veslanje s šipkom', 5, 5]]),
        T('5×5 · B', 'Snaga', [['Čučanj', 5, 5], ['Potisak iznad glave', 5, 5], ['Mrtvo dizanje', 1, 5]])
      ]
    },
    {
      id: 'big3', cat: 'Snaga', name: 'Tri velika dizanja', level: 'Srednji', perWeek: 3,
      desc: 'Svaki trening u fokusu jedno veliko dizanje (čučanj, bench, mrtvo) s teškim trojkama, plus pomoćne vježbe.',
      schedule: [[MON, 0], [WED, 1], [FRI, 2]],
      templates: [
        T('Dan čučnja', 'Snaga', [['Čučanj', 5, 3], ['Bugarski čučanj', 3, 8], ['Pregib nogu', 3, 10], ['Plank (s)', 3, 45]]),
        T('Dan bencha', 'Snaga', [['Bench press', 5, 3], ['Kosi potisak s bučicama', 3, 8], ['Veslanje s bučicom', 3, 10], ['Triceps na sajli', 3, 12]]),
        T('Dan mrtvog dizanja', 'Snaga', [['Mrtvo dizanje', 5, 3], ['Potisak iznad glave', 3, 6], ['Zgibovi', 3, 8], ['Podizanje nogu u visu', 3, 10]])
      ]
    },

    /* ================= POČETNICI ================= */
    {
      id: 'beg', cat: 'Početnici', name: 'Prvi mjeseci u teretani', level: 'Početnik', perWeek: 2,
      desc: 'Uglavnom sprave i bučice — sigurno za učenje pokreta. Dva treninga tjedno, lagano povećavaj težinu kad ti je 12 ponavljanja lako.',
      schedule: [[MON, 0], [THU, 1]],
      templates: [
        T('Početnik A', 'Snaga', [['Nožna preša', 3, 12], ['Potisak na spravi za prsa', 3, 12], ['Lat pulldown', 3, 12], ['Pregib nogu', 3, 12], ['Plank (s)', 3, 20]]),
        T('Početnik B', 'Snaga', [['Goblet čučanj', 3, 10], ['Veslanje na sajli sjedeći', 3, 12], ['Potisak s bučicama sjedeći', 3, 10], ['Glute bridge', 3, 12], ['Dead bug', 3, 10]])
      ]
    },
    {
      id: 'beg3', cat: 'Početnici', name: 'Početnik full body (3×)', level: 'Početnik', perWeek: 3,
      desc: 'Jedan jednostavan trening koji ponavljaš 3× tjedno. Najbrži način da naučiš osnovne pokrete i napreduješ svaki tjedan.',
      schedule: [[MON, 0], [WED, 0], [FRI, 0]],
      templates: [
        T('Početnik full body', 'Snaga', [['Goblet čučanj', 3, 10], ['Potisak s bučicama na ravnoj klupi', 3, 10], ['Lat pulldown', 3, 10], ['Rumunjsko mrtvo dizanje', 2, 10], ['Odručenje s bučicama', 2, 12], ['Plank (s)', 2, 30]])
      ]
    },

    /* ================= KOD KUĆE ================= */
    {
      id: 'homefb', cat: 'Kod kuće', name: 'Full body bez opreme', level: 'Početnik', perWeek: 3,
      desc: 'Samo vlastita težina, stol i pod. Kad dođeš do gornje granice ponavljanja, aplikacija predloži +1 ponavljanje.',
      schedule: [[MON, 0], [WED, 0], [FRI, 0]],
      templates: [
        T('Kod kuće · Full body', 'Snaga', [['Čučanj s vlastitom težinom', 3, 15], ['Sklekovi', 3, 10], ['Inverzno veslanje (stol)', 3, 8], ['Iskoraci unatrag', 3, 10], ['Glute bridge', 3, 15], ['Plank (s)', 3, 30]])
      ]
    },
    {
      id: 'homeul', cat: 'Kod kuće', name: 'Gornji / donji bez opreme', level: 'Srednji', perWeek: 4,
      desc: 'Zahtjevniji kućni program: teže varijante sklekova, jednonožne vježbe i eksplozivni skokovi.',
      schedule: [[MON, 0], [TUE, 1], [THU, 0], [FRI, 1]],
      templates: [
        T('Kod kuće · Gornji', 'Snaga', [['Sklekovi', 4, 12], ['Pike sklekovi', 3, 8], ['Inverzno veslanje (stol)', 4, 10], ['Propadanja na stolici', 3, 10], ['Superman', 3, 12]]),
        T('Kod kuće · Donji', 'Snaga', [['Bugarski čučanj (bez utega)', 3, 10], ['Skokovi iz čučnja', 3, 10], ['Step-up na stolicu', 3, 12], ['Jednonožni glute bridge', 3, 12], ['Wall sit (s)', 3, 45], ['Dead bug', 3, 10]])
      ]
    },
    {
      id: 'homeeasy', cat: 'Kod kuće', name: 'Lagani početak', level: 'Početnik', perWeek: 3,
      desc: 'Za sam početak ili povratak nakon pauze: kratko, lagano i uz šetnju. 20–25 minuta.',
      schedule: [[MON, 0], [WED, 0], [FRI, 0]],
      templates: [
        T('Lagani početak', 'Snaga', [['Sklekovi na koljenima', 3, 8], ['Čučanj s vlastitom težinom', 3, 10], ['Glute bridge', 3, 12], ['Plank (s)', 3, 20], ['Hodanje (min)', 1, 20]])
      ]
    },

    /* ================= BUČICE ================= */
    {
      id: 'dbfb', cat: 'Bučice', name: 'Bučice full body A/B', level: 'Početnik / srednji', perWeek: 3,
      desc: 'Samo par bučica (i klupa ili pod). Kompletan program za cijelo tijelo kod kuće.',
      schedule: [[MON, 0], [WED, 1], [FRI, 0]],
      templates: [
        T('Bučice A', 'Snaga', [['Goblet čučanj', 3, 10], ['Potisak s bučicama na ravnoj klupi', 3, 10], ['Veslanje s bučicom', 3, 10], ['Rumunjsko mrtvo dizanje', 3, 10], ['Odručenje s bučicama', 2, 15]]),
        T('Bučice B', 'Snaga', [['Iskoraci', 3, 10], ['Potisak s bučicama sjedeći', 3, 10], ['Pullover s bučicom', 3, 12], ['Biceps pregib s bučicama', 2, 12], ['Francuski potisak', 2, 12], ['Plank (s)', 3, 30]])
      ]
    },
    {
      id: 'dbul', cat: 'Bučice', name: 'Bučice gornji / donji', level: 'Srednji', perWeek: 4,
      desc: 'Četiri treninga tjedno samo s bučicama — više volumena za mišićnu masu.',
      schedule: [[MON, 0], [TUE, 1], [THU, 0], [FRI, 1]],
      templates: [
        T('Bučice · Gornji', 'Snaga', [['Potisak s bučicama na ravnoj klupi', 4, 10], ['Veslanje s bučicom', 4, 10], ['Potisak s bučicama sjedeći', 3, 10], ['Odručenje s bučicama', 3, 15], ['Biceps pregib s bučicama', 3, 12], ['Francuski potisak', 3, 12]]),
        T('Bučice · Donji', 'Snaga', [['Goblet čučanj', 4, 12], ['Rumunjsko mrtvo dizanje', 4, 10], ['Bugarski čučanj', 3, 10], ['Hip thrust', 3, 12], ['Podizanje na prste', 3, 20]])
      ]
    },

    /* ================= MRŠAVLJENJE ================= */
    {
      id: 'fatloss', cat: 'Mršavljenje', name: 'Snaga + kardio', level: 'Početnik / srednji', perWeek: 3,
      desc: 'Najbolja kombinacija za skidanje masti: snaga čuva mišiće, kardio na kraju troši dodatne kalorije. ~60 min.',
      schedule: [[MON, 0], [WED, 1], [FRI, 0]],
      templates: [
        T('Mršavljenje A', 'Snaga', [['Čučanj', 3, 10], ['Bench press', 3, 10], ['Veslanje s šipkom', 3, 10], ['Traka s nagibom (min)', 1, 20]]),
        T('Mršavljenje B', 'Snaga', [['Rumunjsko mrtvo dizanje', 3, 10], ['Potisak iznad glave', 3, 10], ['Lat pulldown', 3, 12], ['Bicikl (min)', 1, 20]])
      ]
    },
    {
      id: 'circuit', cat: 'Mršavljenje', name: 'Kružni trening', level: 'Srednji', perWeek: 3,
      desc: 'Vježbe jedna za drugom bez odmora, 90 s odmora između krugova. Puls visoko cijelo vrijeme.',
      schedule: [[MON, 0], [WED, 0], [FRI, 0]],
      templates: [
        T('Kružni trening', 'HIIT', [['Kettlebell swing', 4, 15], ['Goblet čučanj', 4, 12], ['Sklekovi', 4, 12], ['Veslanje s bučicom', 4, 12], ['Farmer walk (m)', 4, 40], ['Mountain climbers', 4, 30]],
          { notes: 'Bez odmora između vježbi, 90 s odmora između krugova.', duration: 35 })
      ]
    },
    {
      id: 'hiit20', cat: 'Mršavljenje', name: 'HIIT 20 minuta', level: 'Srednji', perWeek: 2,
      desc: 'Kratko i intenzivno, bez opreme. 40 s rada / 20 s odmora, 4 kruga.',
      schedule: [[TUE, 0], [THU, 0]],
      templates: [
        T('HIIT 20', 'HIIT', [['Burpees', 4, 10], ['Skokovi iz čučnja', 4, 15], ['Mountain climbers', 4, 30], ['Sklekovi', 4, 10], ['Jumping jacks', 4, 40]],
          { notes: '40 s rada / 20 s odmora, 4 kruga.', duration: 20 })
      ]
    },
    {
      id: 'tabata', cat: 'Mršavljenje', name: 'Tabata', level: 'Napredni', perWeek: 2,
      desc: 'Svaka vježba 8 rundi po 20 s maksimalno + 10 s odmora (4 minute). 1 minuta odmora između vježbi.',
      schedule: [[TUE, 0], [SAT, 0]],
      templates: [
        T('Tabata', 'HIIT', [['Burpees', 8, 6], ['Skokovi iz čučnja', 8, 10], ['Mountain climbers', 8, 20], ['Sklekovi', 8, 8]],
          { notes: '20 s rada / 10 s odmora × 8 po vježbi.', duration: 20 })
      ]
    },

    /* ================= KARDIO ================= */
    {
      id: 'run5k', cat: 'Kardio', name: 'Od kauča do 5 km', level: 'Početnik', perWeek: 3,
      desc: 'Izmjena trčanja i hodanja. Kad odradiš sve intervale, aplikacija predloži jedan više — za ~8 tjedana trčiš 30 minuta bez stajanja.',
      schedule: [[MON, 0], [WED, 0], [SAT, 0]],
      templates: [
        T('Trčanje · intervali', 'Kardio', [['Zagrijavanje hodanjem (min)', 1, 5], ['Interval: 1 min trčanje + 1,5 min hodanje (broj)', 1, 8], ['Hlađenje hodanjem (min)', 1, 5]], { duration: 30 })
      ]
    },
    {
      id: 'zone2', cat: 'Kardio', name: 'Lagani kardio (zona 2)', level: 'Svi', perWeek: 3,
      desc: 'Tempo u kojem možeš pričati, 30–60 minuta. Gradi kondiciju i troši masti, a ne umara za teretanu.',
      schedule: [[TUE, 0], [THU, 0], [SUN, 0]],
      templates: [
        T('Lagani kardio', 'Kardio', [['Lagano trčanje ili bicikl (min)', 1, 40]], { duration: 40 })
      ]
    },
    {
      id: 'sprints', cat: 'Kardio', name: 'Intervalno trčanje', level: 'Srednji', perWeek: 1,
      desc: 'Kratki sprintovi s odmorom hodanjem. Jednom tjedno za brzinu i kondiciju.',
      schedule: [[SAT, 0]],
      templates: [
        T('Sprintovi', 'Kardio', [['Zagrijavanje laganim trčanjem (min)', 1, 10], ['Sprint 30 s + 90 s hodanja (broj)', 1, 8], ['Hlađenje hodanjem (min)', 1, 5]], { duration: 30 })
      ]
    },
    {
      id: 'incline', cat: 'Kardio', name: 'Traka s nagibom', level: 'Svi', perWeek: 3,
      desc: 'Brzo hodanje uzbrdo (nagib 8–12 %, 5–6 km/h). Malo opterećuje zglobove, a troši puno kalorija.',
      schedule: [[TUE, 0], [THU, 0], [SAT, 0]],
      templates: [
        T('Traka s nagibom', 'Kardio', [['Traka s nagibom (min)', 1, 30]], { duration: 30 })
      ]
    },
    {
      id: 'mixcardio', cat: 'Kardio', name: 'Kardio mix u teretani', level: 'Svi', perWeek: 2,
      desc: 'Tri sprave po 10–15 minuta — manje dosadno od jedne sprave sat vremena.',
      schedule: [[TUE, 0], [THU, 0]],
      templates: [
        T('Kardio mix', 'Kardio', [['Veslanje ergometar (min)', 1, 10], ['Bicikl (min)', 1, 15], ['Traka s nagibom (min)', 1, 15]], { duration: 40 })
      ]
    },

    /* ================= MOBILNOST ================= */
    {
      id: 'morning', cat: 'Mobilnost', name: 'Jutarnja mobilnost (10 min)', level: 'Svi', perWeek: 7,
      desc: 'Za ukočeno tijelo nakon sna ili sjedenja. Polagano i bez forsiranja.',
      templates: [
        T('Jutarnja mobilnost', 'Mobilnost', [['Mačka-krava', 1, 10], ['Kruženje ramenima', 1, 15], ['Iskorak s rotacijom', 1, 6], ['Otvaranje kukova 90/90', 1, 8], ['Duboki čučanj zadržaj (s)', 1, 45], ['Dječji položaj (s)', 1, 45]], { duration: 10 })
      ]
    },
    {
      id: 'stretch', cat: 'Mobilnost', name: 'Istezanje nakon treninga', level: 'Svi', perWeek: 3,
      desc: 'Pet minuta na kraju treninga za stražnju ložu, kukove, prsa i bedra.',
      templates: [
        T('Istezanje nakon treninga', 'Mobilnost', [['Istezanje stražnje lože (s)', 2, 30], ['Istezanje pregibača kuka (s)', 2, 30], ['Istezanje prsa na zidu (s)', 2, 30], ['Istezanje kvadricepsa (s)', 2, 30], ['Dječji položaj (s)', 1, 60]], { duration: 10 })
      ]
    },
    {
      id: 'back', cat: 'Mobilnost', name: 'Za ukočena leđa', level: 'Svi', perWeek: 3,
      desc: 'Nježne vježbe za stabilnost trupa i pokretljivost kralježnice. Ako imaš bol, prvo se posavjetuj s liječnikom ili fizioterapeutom.',
      templates: [
        T('Ukočena leđa', 'Mobilnost', [['Mačka-krava', 2, 10], ['Dead bug', 3, 8], ['Bird dog', 3, 8], ['Glute bridge', 3, 12], ['Kobra (s)', 2, 20], ['Dječji položaj (s)', 2, 30]], { duration: 15 })
      ]
    },

    /* ================= DIJELOVI TIJELA ================= */
    {
      id: 'glutes', cat: 'Dijelovi tijela', name: 'Guza i noge', level: 'Srednji', perWeek: 2,
      desc: 'Fokus na stražnjicu i stražnju ložu. Dobro se kombinira s bilo kojim splitom.',
      templates: [
        T('Guza i noge', 'Snaga', [['Hip thrust', 4, 10], ['Bugarski čučanj', 3, 10], ['Rumunjsko mrtvo dizanje', 3, 10], ['Abdukcija kukova', 3, 15], ['Glute bridge', 2, 20]])
      ]
    },
    {
      id: 'arms', cat: 'Dijelovi tijela', name: 'Ruke', level: 'Srednji', perWeek: 1,
      desc: 'Biceps i triceps u superserijama — dodatni dan za ruke.',
      templates: [
        T('Ruke', 'Snaga', [['Biceps pregib', 4, 10], ['Francuski potisak', 4, 10], ['Čekić pregib', 3, 12], ['Triceps na sajli', 3, 12], ['Koncentrirani pregib', 2, 15], ['Propadanja (dips)', 2, 12]])
      ]
    },
    {
      id: 'shoulders', cat: 'Dijelovi tijela', name: 'Ramena', level: 'Srednji', perWeek: 1,
      desc: 'Sve tri glave ramena + zdravlje ramenog zgloba (face pull).',
      templates: [
        T('Ramena', 'Snaga', [['Potisak iznad glave', 4, 8], ['Odručenje s bučicama', 4, 15], ['Face pull', 3, 15], ['Potisak s bučicama sjedeći', 3, 10], ['Odručenje u pretklonu', 3, 15]])
      ]
    },
    {
      id: 'core', cat: 'Dijelovi tijela', name: 'Trbušnjaci i core (15 min)', level: 'Svi', perWeek: 3,
      desc: 'Kratko na kraju treninga ili kao zaseban mini trening kod kuće.',
      templates: [
        T('Core', 'Snaga', [['Plank (s)', 3, 45], ['Bočni plank (s)', 3, 30], ['Podizanje nogu u visu', 3, 12], ['Ruski twist', 3, 20], ['Dead bug', 3, 10], ['Trbušnjaci (crunch)', 3, 20]], { duration: 15 })
      ]
    },
    {
      id: 'chestback', cat: 'Dijelovi tijela', name: 'Prsa i leđa', level: 'Srednji', perWeek: 1,
      desc: 'Suprotne mišićne skupine u izmjeni — puno posla u kratkom vremenu.',
      templates: [
        T('Prsa i leđa', 'Snaga', [['Bench press', 4, 8], ['Veslanje s šipkom', 4, 8], ['Kosi potisak s bučicama', 3, 10], ['Lat pulldown', 3, 10], ['Razvlačenje na sajli', 2, 15], ['Face pull', 2, 15]])
      ]
    }
  ];
})();
