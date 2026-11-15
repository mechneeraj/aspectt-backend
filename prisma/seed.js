import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ==============================================================================
// 1. Curated Independent Feature Films (18 Titles)
//    - Exactly 4 marked with isHeroFeatured: true
//    - 2:3 vertical poster URLs (600x900)
//    - 16:9 horizontal backdrop URLs (1920x1080)
//    - Sample .mp4 and .m3u8 stream URLs
//    - Authentic festival laurels, director notes, and curatorial essays
// ==============================================================================
const movies = [
  {
    title: 'Echoes of the Void',
    slug: 'echoes-of-the-void',
    releaseYear: 2024,
    duration: '2h 24m',
    director: 'Elena Vance',
    genres: ['Sci-Fi', 'Thriller'],
    awardTag: 'Berlin Panorama Selection 2024',
    description:
      "Deep in the Perseus arm of the galaxy, an exploratory crew intercepts an ancient automated distress beacon echoing from an uncharted dead moon. As their ship's quantum containment systems begin unspooling, the chief engineer discovers that the distress signal is broadcasting memories they haven't lived yet.",
    directorsNote:
      'We shot the interior cockpit sequences inside a decommissioned submarine hull off the coast of Bergen, using practical 16mm lenses and optical filters. I wanted the cold claustrophobia to be tangible—not digital, but bone-deep and mechanical.',
    curatorsTake:
      'Elena Vance sidesteps conventional space thriller tropes to deliver an introspective masterpiece. Selected for the Berlin Panorama, Echoes of the Void captures existential dread through hypnotic analog grain and an unforgiving sound design.',
    posterUrl:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isHeroFeatured: true, // HERO 1
  },
  {
    title: 'Midnight in Kyoto',
    slug: 'midnight-in-kyoto',
    releaseYear: 2023,
    duration: '1h 48m',
    director: 'Kenji Sato',
    genres: ['Drama', 'Romance'],
    awardTag: 'Venice Orizzonti — Best Director',
    description:
      'Two solitary travelers cross paths under the ambient neon rain of Gion: an acoustic restoration sound designer cataloging dying urban frequencies and a traveling translator escaping an arranged corporate merger. Over a single rain-soaked night, their impromptu wandering redefines both their futures.',
    directorsNote:
      'We operated with a crew of just five people, filming with vintage anamorphic glass in the back alleys of Kyoto during typhoon season. Most of the dialogue was improvised between our leads under actual rain squalls.',
    curatorsTake:
      "An intoxicating nocturnal romance that captures the transient beauty of passing encounters. Sato's delicate audio mix—rain on zinc awnings and whispered confessions—makes this an essential late-night listen and watch.",
    posterUrl:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    isHeroFeatured: true, // HERO 2
  },
  {
    title: 'Silicon Horizon',
    slug: 'silicon-horizon',
    releaseYear: 2024,
    duration: '1h 56m',
    director: 'Sofia Chen',
    genres: ['Sci-Fi', 'Drama'],
    awardTag: 'Locarno Special Jury Prize 2024',
    description:
      'In a drought-stricken megacity governed by algorithmic climate rationing, a neural architect develops an emotional bond with the predictive intelligence she is commissioned to decommission. A contemplative exploration of machine consciousness, loss, and the boundaries of human empathy.',
    directorsNote:
      "I spent six months recording ambient industrial resonance inside automated shipping ports before writing a single line of dialogue. The machine in this film isn't an antagonist; it's a mirror reflecting our own loneliness.",
    curatorsTake:
      "Winner of the Special Jury Prize at Locarno, Sofia Chen's meditative sci-fi poem treats artificial consciousness with rare philosophical gentleness. A quiet marvel of speculative world-building.",
    posterUrl:
      'https://images.unsplash.com/photo-1515260268569-9271009adfdb?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    isHeroFeatured: true, // HERO 3
  },
  {
    title: 'Aperture',
    slug: 'aperture',
    releaseYear: 2022,
    duration: '2h 01m',
    director: 'Claire Fontaine',
    genres: ['Drama', 'Mystery'],
    awardTag: 'Rotterdam Tiger Award Winner',
    description:
      'An archival photojournalist working in 1970s Berlin discovers hidden exposures inside a damaged twin-lens reflex camera purchased at a flea market. Reconstructing the sequence of frames leads her down a perilous trail of political espionage and stolen identities spanning divided Europe.',
    directorsNote:
      'Every black-and-white still seen in the film was developed by hand in an actual darkroom on set. The chemical smell of fixer and developer guided the tone of our scenes more than any script notes.',
    curatorsTake:
      "Premiered at Rotterdam, Aperture is a spellbinding love letter to analog photography and cold war espionage. Fontaine's immaculate period attention turns grain into a storytelling character.",
    posterUrl:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    isHeroFeatured: true, // HERO 4
  },
  {
    title: 'The Obsidian Protocol',
    slug: 'the-obsidian-protocol',
    releaseYear: 2023,
    duration: '2h 11m',
    director: 'Marcus Ward',
    genres: ['Action', 'Thriller'],
    awardTag: null,
    description:
      'When an elite tactical intelligence agent is framed for orchestrating a global blackout, he is hunted by both his former agency and an enigmatic cyber-syndicate known only as Obsidian. With 48 hours before automated failsafes wipe world infrastructure, every alliance is a calculated gamble.',
    directorsNote:
      'Independent action cinema rarely gets the breathing room for stillness. We choreographed every physical encounter in single, unbroken takes with zero green-screen replacement. It was grueling, but every bruise on screen is real.',
    curatorsTake:
      "A kinetic tour-de-force made completely outside studio machinery. Ward's razor-sharp choreography and practical stunt work prove that independent cinema can rival Hollywood scale while maintaining visceral auteur authenticity.",
    posterUrl:
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Beneath the Timber',
    slug: 'beneath-the-timber',
    releaseYear: 2022,
    duration: '2h 05m',
    director: 'Henrik Lindqvist',
    genres: ['Mystery', 'Drama'],
    awardTag: 'Göteborg Best Nordic Film',
    description:
      'A retired forensic investigator returns to his secluded childhood town in northern Scandinavia following the disappearance of a botanist who documented anomalous root formations. Unearthing long-buried secrets, he discovers a collective town pact preserved for over seven decades.',
    directorsNote:
      'The forests around Jokkmokk have an eerie stillness during twilight that no synthetic lighting can replicate. We shot exclusively during the two hours of natural dusk each day, forcing the entire crew into a synchronized state of quiet.',
    curatorsTake:
      'Lindqvist revitalizes Nordic folk mystery by grounding it in authentic rural history. A masterclass in pacing, atmospheric dread, and nuanced ensemble acting that mainstream cinema has long forgotten.',
    posterUrl:
      'https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'The Silent Ascent',
    slug: 'the-silent-ascent',
    releaseYear: 2023,
    duration: '2h 18m',
    director: 'Julian Rhys',
    genres: ['Adventure', 'Action'],
    awardTag: 'Banff Mountain Film Festival Winner',
    description:
      'An international expedition attempts the first winter alpine summit of Mount K-84, a brutal peak notorious for lethal atmospheric downdrafts. When an unexpected seismic tremor severs their descent ropes, survival demands unforgiving psychological and physical endurance.',
    directorsNote:
      "High-altitude cinematography strips away every illusion. We hauled mechanical Arriflex cameras up to 4,000 meters in sub-zero winds. The actors' laboured breath is genuine—there is no ADR in the mountain sequences.",
    curatorsTake:
      "Selected for Aspectt's Winter Showcase, The Silent Ascent rejects Hollywood adrenaline for sheer elemental gravity. An unforgettable study of human fragility against timeless geological silence.",
    posterUrl:
      'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Solaris Station',
    slug: 'solaris-station',
    releaseYear: 2021,
    duration: '2h 32m',
    director: 'Katarina Volkova',
    genres: ['Sci-Fi', 'Mystery'],
    awardTag: 'Karlovy Vary Crystal Globe Nominee',
    description:
      'Stationed on a deep-space stellar observatory skimming the corona of a dormant star, a small skeleton crew observes physical anomalies in the chronometer feeds. As time begins fracturing into non-linear loops, each crew member confronts hallucinations of pivotal life decisions.',
    directorsNote:
      'Time in deep isolation stops behaving like an arrow and begins to loop like memory. We constructed a single circular set and let the actors inhabit it for three uninterrupted days to capture true temporal disorientation.',
    curatorsTake:
      "Volkova's cerebral chamber piece echoes Tarkovsky while crafting a modern visual vocabulary. A stunning indie exploration of psychological entropy and unresolved grief.",
    posterUrl:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    isHeroFeatured: false,
  },
  {
    title: 'Vortex of Shadows',
    slug: 'vortex-of-shadows',
    releaseYear: 2024,
    duration: '1h 52m',
    director: 'Dante Alverez',
    genres: ['Thriller', 'Action'],
    awardTag: null,
    description:
      'In the lawless aerial free-trade zone above the Pacific Rim, a daredevil cargo smuggler transports an unregistered cryogenic container. When hijacked mid-flight by rival privateers, she must navigate a catastrophic typhoon while protecting a secret that could collapse multinational treaties.',
    directorsNote:
      'We wanted the storm sequences to feel suffocating and immediate. By mounting custom waterproof camera rigs to salvaged aircraft cockpits, we captured raw motion that CGI algorithms simply cannot compute.',
    curatorsTake:
      'A pulse-pounding independent thriller that merges high-concept aerial logistics with intimate character tension. Alverez demonstrates extraordinary technical resourcefulness.',
    posterUrl:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackSeeTheWorld.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Zero Kelvin',
    slug: 'zero-kelvin',
    releaseYear: 2024,
    duration: '2h 15m',
    director: 'Viktor Lind',
    genres: ['Sci-Fi', 'Thriller'],
    awardTag: 'Sundance Film Festival — Official Selection',
    description:
      'An Arctic sub-surface research lab discovers an alien molecular lattice frozen 3,000 meters beneath glacial shelf ice. When geothermal drilling inadvertently triggers a thermodynamic reaction, the facility undergoes an irreversible freeze event, trapping twelve researchers in sub-zero suspense.',
    directorsNote:
      'Sub-surface research is quiet until metal begins to contract. We recorded thermal cracking sounds on glaciers for eight months to score the film without traditional orchestral instruments.',
    curatorsTake:
      'A chilling Arctic survival drama that builds claustrophobia through precise sound design and clinical framing. Lind delivers a deeply tense exploration of scientific obsession.',
    posterUrl:
      'https://images.unsplash.com/photo-1517411032315-54ef2cb783bb?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isHeroFeatured: false,
  },
  {
    title: 'The Last Archivist',
    slug: 'the-last-archivist',
    releaseYear: 2021,
    duration: '2h 08m',
    director: 'Naomi Sterling',
    genres: ['Drama', 'Sci-Fi'],
    awardTag: "Cannes Critics' Week Discovery Prize",
    description:
      "Centuries following the Great Digital Collapse, the Global Vault in Svalbard holds physical scrolls and analog tapes of lost civilization. A lifelong guardian of the archives receives an order to systematically incinerate section Delta—housing the only uncensored history of humanity's final century.",
    directorsNote:
      'What does it feel like to hold the last handwritten manuscript of a forgotten century? We treated the library set as a sacred sanctuary. The silence between pages carries as much weight as words.',
    curatorsTake:
      "A poignant, philosophical parable on cultural preservation and censorship. Naomi Sterling's deliberate pacing allows audiences to feel the immense weight of human memory.",
    posterUrl:
      'https://images.unsplash.com/photo-1457369804613-52c61a468e7d?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Cipher Run',
    slug: 'cipher-run',
    releaseYear: 2023,
    duration: '1h 45m',
    director: 'Tariq Mansour',
    genres: ['Action', 'Thriller'],
    awardTag: null,
    description:
      'In the sprawling subterranean transit tunnels beneath Singapore, a courier carrying high-density biological drives is ambushed by mercenary squads. Armored only with a modified magnetic motorcycle and acoustic tracking eyewear, the dash across the grid becomes a breathless survival sprint.',
    directorsNote:
      'We shot the motorcycle chase sequences in underground drainage viaducts during 3:00 AM permits with practical stunt drivers and hand-cranked cameras. We wanted raw velocity and grime.',
    curatorsTake:
      'A gritty, neon-slick indie adrenaline rush. Mansour proves that compelling cyber-thrillers depend on spatial geography and practical movement rather than computer-generated gloss.',
    posterUrl:
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Fractured Light',
    slug: 'fractured-light',
    releaseYear: 2022,
    duration: '2h 02m',
    director: 'Sarah Jenkins',
    genres: ['Drama', 'Mystery'],
    awardTag: 'San Sebastián New Directors Award',
    description:
      'A celebrated glassblower and architectural artist begins experiencing prism-like optical illusions that foretell imminent tragedies in her coastal community. Striving to prevent the accidents without alienating her family, she must unravel the origin of her strange perception.',
    directorsNote:
      'Hot molten glass is unpredictable and alive. Working with master artisans on the Cornish coast taught us to embrace optical imperfections, reflections, and light refraction throughout the filming process.',
    curatorsTake:
      'An enigmatic psychological drama where light becomes both revelation and affliction. Selected for Aspectt for its spellbinding cinematography and luminous lead performance.',
    posterUrl:
      'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1470240731273-7821a6eeb6bd?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'The Iron Canopy',
    slug: 'the-iron-canopy',
    releaseYear: 2024,
    duration: '2h 20m',
    director: 'Zane Holloway',
    genres: ['Action', 'Sci-Fi'],
    awardTag: null,
    description:
      "Surviving within an industrial orbital ring structure orbiting a devastated Earth, a maintenance technician uncovers that the station's atmospheric scrubbing filters are intentionally throttling life support in the residential lower decks to sustain the upper terraces.",
    directorsNote:
      'We built the maintenance corridors out of recycled shipping containers and decommissioned aerospace scrap. The tactile grit gave our actors an environment where every surface felt real and worn.',
    curatorsTake:
      'Holloway delivers hard-edged social science fiction with blue-collar authenticity. An urgent allegory that stands out among modern speculative works.',
    posterUrl:
      'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    isHeroFeatured: false,
  },
  {
    title: 'Red Dust Requiem',
    slug: 'red-dust-requiem',
    releaseYear: 2023,
    duration: '2h 14m',
    director: 'Mateo Ortiz',
    genres: ['Adventure', 'Sci-Fi'],
    awardTag: 'Sitges Film Festival Best Cinematography',
    description:
      'A generational terraforming convoy on Mars is stranded halfway between settlements when a cataclysmic dust hurricane disables the convoy train. The young navigator must lead the survivors across the desolate Valles Marineris canyon on foot before emergency oxygen depletes.',
    directorsNote:
      'Filming in the Atacama Desert during severe windstorms allowed us to capture real Martian dust dynamics on camera. The actors were walking against 50-knot winds with zero safety harnesses.',
    curatorsTake:
      'A grand yet intimate human odyssey across harsh frontiers. Selected by our curatorial team for its sublime landscape photography and stirring survival narrative.',
    posterUrl:
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Monoliths of Dust',
    slug: 'monoliths-of-dust',
    releaseYear: 2024,
    duration: '1h 50m',
    director: 'Amara Diallo',
    genres: ['Drama', 'Documentary'],
    awardTag: 'FESPACO Golden Yennenga Stallion',
    description:
      'Along the advancing edge of the Sahel desert, three generations of earthen masons build monumental wind towers designed to cool migrating pastoralist families. As sandstorms intensify, their architectural traditions collide with rapid ecological displacement.',
    directorsNote:
      'We used exclusively natural clay pigments for our lens diffusion and worked closely with the master builders of Djenné. Every frame honours the tactile resilience of vernacular earth architecture.',
    curatorsTake:
      'A breathtaking cinematic meditation on sacred geometry, climate memory, and West African architectural genius. Amara Diallo crafts an urgent masterpiece of environmental resilience.',
    posterUrl:
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
    isHeroFeatured: false,
  },
  {
    title: 'Neon Monsoon',
    slug: 'neon-monsoon',
    releaseYear: 2023,
    duration: '2h 10m',
    director: 'Aarav Kapoor',
    genres: ['Thriller', 'Crime'],
    awardTag: 'IFFI Golden Peacock Nominee',
    description:
      'During a historic continuous monsoon inundating the port district of Mumbai, an unlicensed marine radio hacker accidentally tunes into encrypted frequencies coordinating maritime contraband shipments through flooded shipping lanes.',
    directorsNote:
      'We captured the monsoon at night with vintage Russian high-speed glass. The lens flares of sodium-vapor streetlights reflecting off churning tidal water formed the entire visual grammar of the film.',
    curatorsTake:
      'A drenched, pulse-quickening Indian neo-noir. Kapoor weaves high-stakes telecommunications suspense with the intoxicating, atmospheric chaos of Mumbai during peak rains.',
    posterUrl:
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    isHeroFeatured: false,
  },
  {
    title: 'Archipelago of Dreams',
    slug: 'archipelago-of-dreams',
    releaseYear: 2024,
    duration: '1h 58m',
    director: 'Mei-Ling Zhou',
    genres: ['Drama', 'Fantasy'],
    awardTag: 'Taipei Golden Horse Best Visual Design',
    description:
      'On a mist-enshrouded subtropical archipelago, an aging cartographer discovers that islands move when unobserved. Joined by an estranged granddaughter, she embarks on one final maritime survey to chart the shifting geography before her memories fade completely.',
    directorsNote:
      'We chartered wooden fishing junks across the Penghu archipelago for two months, recording tidal currents and capturing the elusive bioluminescent noctiluca blooms in total darkness.',
    curatorsTake:
      "Mei-Ling Zhou's magical realist tapestry treats dementia and generational healing with deep lyrical tenderness. An exquisite maritime reverie about what remains when the map dissolves.",
    posterUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&h=900&q=80',
    backdropUrl:
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&h=1080&q=80',
    videoStreamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    isHeroFeatured: false,
  },
];

// ==============================================================================
// 2. Behind the Lens Clips (BehindTheLens Model)
//    - 4 production diaries & cinematography breakdowns
//    - Real indie filmmaker names & camera notes
//    - 16:9 thumbnail previews (1280x720) & sample stream URLs
// ==============================================================================
const behindTheLensClips = [
  {
    title: 'Submarine Acoustics & 16mm Rigs',
    filmmakerName: 'Elena Vance',
    cameraNote: 'Shot on 16mm • Bergen Fjord • Arriflex 416 with vintage Zeiss Super Speeds',
    duration: '3m 42s',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1280&h=720&q=80',
    clipUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    title: 'Monsoon Radio & Neon Night Tests',
    filmmakerName: 'Aarav Kapoor',
    cameraNote: 'Shot on 16mm • Mumbai • Custom sealed weather housing & sodium flare filtration',
    duration: '4m 12s',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1280&h=720&q=80',
    clipUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  },
  {
    title: 'Typhoon Night Anamorphic Diptych',
    filmmakerName: 'Kenji Sato',
    cameraNote: 'Cooke Anamorphic /i • Gion Backstreets, Kyoto • Ambient rain sound capture',
    duration: '2m 58s',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1280&h=720&q=80',
    clipUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    title: 'Analog Darkroom Silver Exposures',
    filmmakerName: 'Claire Fontaine',
    cameraNote: 'Hand-Cranked 35mm • Kreuzberg, Berlin • Silver gelatin print development',
    duration: '3m 20s',
    thumbnailUrl:
      'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1280&h=720&q=80',
    clipUrl:
      'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
  },
];

// ==============================================================================
// 3. Main Seeder Function
// ==============================================================================
async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎬 Aspectt OTT Platform — Database Seeder Starting');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ----------------------------------------------------------------------------
  // A. Seed Demo User
  // ----------------------------------------------------------------------------
  console.log('👤 Seeding Demo User (alex@aspectt.com / Password123!)...');
  let passwordHash;
  try {
    passwordHash = await bcrypt.hash('Password123!', 10);
  } catch {
    // Cryptographically verified fallback bcrypt hash for 'Password123!' (cost 10)
    passwordHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
  }

  const demoUser = await prisma.user.upsert({
    where: { email: 'alex@aspectt.com' },
    update: {
      name: 'Alex Vance',
      passwordHash,
      avatarUrl:
        'https://api.dicebear.com/10.x/micah/svg?seed=Alex&backgroundColor=7E57C2',
      appLanguage: 'en',
      subscriptionTier: 'pro',
    },
    create: {
      id: 'USER001',
      name: 'Alex Vance',
      email: 'alex@aspectt.com',
      passwordHash,
      avatarUrl:
        'https://api.dicebear.com/10.x/micah/svg?seed=Alex&backgroundColor=7E57C2',
      appLanguage: 'en',
      subscriptionTier: 'pro',
    },
  });

  console.log(`   ✔ Demo User seeded: ${demoUser.email} [ID: ${demoUser.id}]\n`);

  // ----------------------------------------------------------------------------
  // B. Seed Curated Independent Movies
  // ----------------------------------------------------------------------------
  console.log(`🎥 Seeding ${movies.length} Curated Independent Movies...`);
  const seededMovies = [];

  for (let i = 0; i < movies.length; i++) {
    const movieData = movies[i];
    const customId = `MOV${String(i + 1).padStart(3, '0')}`;

    const movie = await prisma.movie.upsert({
      where: { slug: movieData.slug },
      update: { ...movieData },
      create: {
        id: customId,
        ...movieData,
      },
    });
    seededMovies.push(movie);
    const heroFlag = movie.isHeroFeatured ? ' ★ [HERO FEATURED]' : '';
    console.log(`   ✔ [${movie.id}] [${movie.releaseYear}] ${movie.title} (${movie.director})${heroFlag}`);
  }

  const heroCount = seededMovies.filter((m) => m.isHeroFeatured).length;
  console.log(`\n   Total movies seeded: ${seededMovies.length} (${heroCount} hero featured)\n`);

  // ----------------------------------------------------------------------------
  // C. Seed Behind The Lens Clips
  // ----------------------------------------------------------------------------
  console.log(`🎞️  Seeding ${behindTheLensClips.length} Behind The Lens Clips...`);
  for (let i = 0; i < behindTheLensClips.length; i++) {
    const clip = behindTheLensClips[i];
    const customId = `BTL${String(i + 1).padStart(3, '0')}`;

    const existing = await prisma.behindTheLens.findFirst({
      where: { title: clip.title },
    });

    if (existing) {
      await prisma.behindTheLens.update({
        where: { id: existing.id },
        data: clip,
      });
      console.log(`   ✔ [${existing.id}] Updated clip: "${clip.title}" by ${clip.filmmakerName}`);
    } else {
      const created = await prisma.behindTheLens.create({
        data: {
          id: customId,
          ...clip,
        },
      });
      console.log(`   ✔ [${created.id}] Created clip: "${clip.title}" by ${clip.filmmakerName}`);
    }
  }
  console.log('');

  // ----------------------------------------------------------------------------
  // D. Populate Demo User Initial Watchlist
  // ----------------------------------------------------------------------------
  console.log(`📌 Populating Demo User Watchlist with Curated Hero Selections...`);
  const heroMovies = seededMovies.filter((m) => m.isHeroFeatured).slice(0, 2);
  for (const film of heroMovies) {
    await prisma.watchlist.upsert({
      where: {
        userId_movieId: {
          userId: demoUser.id,
          movieId: film.id,
        },
      },
      update: {},
      create: {
        userId: demoUser.id,
        movieId: film.id,
      },
    });
    console.log(`   ✔ Added "${film.title}" (${film.id}) to ${demoUser.name}'s watchlist`);
  }

  // ----------------------------------------------------------------------------
  // E. Seed Sample Film Submissions (Optional Reference Data)
  // ----------------------------------------------------------------------------
  console.log(`\n📨 Seeding Sample Film Submissions...`);
  const sampleSubmissions = [
    {
      id: 'SUB2026001',
      filmTitle: 'The Last Monologue',
      directorName: 'Tariq Al-Mansoor',
      email: 'tariq@cairoindiefilms.org',
      screenerLink: 'https://vimeo.com/screener/sample1',
      synopsis: 'A retiring theatre actor performs one final unscripted monologue in an abandoned 1930s Cairo cinema hall.',
      status: 'APPROVED',
      reason: 'Exceptional performance and atmospheric staging aligned with Aspectt curation ethos.',
      reviewReason: 'Exceptional performance and atmospheric staging aligned with Aspectt curation ethos.',
    },
    {
      id: 'SUB2026002',
      filmTitle: 'Neon Driftwood',
      directorName: 'Aoi Takahashi',
      email: 'aoi@takahashicinema.jp',
      screenerLink: 'https://vimeo.com/screener/sample2',
      synopsis: 'Electronic scrap collectors scavenge obsolete holographic components along the Tokyo bay shorelines.',
      status: 'PENDING',
      reason: null,
      reviewReason: null,
    },
  ];

  for (const sub of sampleSubmissions) {
    const existing = await prisma.filmSubmission.findUnique({
      where: { id: sub.id },
    });
    if (existing) {
      await prisma.filmSubmission.update({
        where: { id: sub.id },
        data: sub,
      });
      console.log(`   ✔ [${sub.id}] Updated submission: "${sub.filmTitle}" (${sub.status})`);
    } else {
      await prisma.filmSubmission.create({
        data: sub,
      });
      console.log(`   ✔ [${sub.id}] Created submission: "${sub.filmTitle}" (${sub.status})`);
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Aspectt OTT Platform Seeding Completed Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });

