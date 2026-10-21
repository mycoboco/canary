// Maps a free-form genre tag (ID3/Winamp or free text, incl. Korean) to an icon
// bucket. Icons live at public/genres/<bucket>.svg (monochrome silhouettes).

const BUCKETS = {
  rock: ['Rock', 'Classic Rock', 'Hard Rock', 'Rock & Roll', "Rock 'n' Roll", 'Alternative',
    'Alternative Rock', 'Alt Rock', 'Grunge', 'Indie', 'Indie Rock', 'BritPop', 'Garage',
    'Garage Rock', 'Southern Rock', 'Progressive Rock', 'Prog Rock', 'Psychedelic Rock',
    'Psychedelic', 'Post-Rock', 'Space Rock', 'Surf Rock', 'Folk-Rock', 'Shoegaze',
    '록', '락', '하드록', '인디', '인디록', '얼터너티브'],
  punk: ['Punk', 'Punk Rock', 'Hardcore', 'Post-Punk', 'Emo', 'Ska-Punk', 'Acid Punk',
    '펑크', '펑크록'],
  metal: ['Metal', 'Heavy Metal', 'Death Metal', 'Black Metal', 'Thrash Metal', 'Doom Metal',
    'Nu Metal', 'Metalcore', 'Grindcore', 'Industrial', 'Gothic', 'Gothic Rock', 'Darkwave',
    '메탈', '헤비메탈', '데스메탈'],
  pop: ['Pop', 'Top 40', 'Synthpop', 'Synth-Pop', 'Dance-Pop', 'Electropop', 'New Wave', 'Dream',
    '팝', '댄스팝', '신스팝'],
  jpop: ['JPop', 'J-Pop', 'Japanese', 'Japan', 'J-Rock', 'Shibuya-kei',
    '제이팝', '일본', '일본음악', '재패니즈'],
  kpop: ['KPop', 'K-Pop', 'Korean', 'Korea', 'K-Ballad', 'Korean Pop',
    '케이팝', '한국', '한국가요', '가요', '코리안'],
  hiphop: ['Hip-Hop', 'Hip Hop', 'Rap', 'Gangsta', 'Gangsta Rap', 'Trip-Hop', 'G-Funk',
    'Boom Bap', 'Trap',
    '힙합', '랩'],
  rnb: ['R&B', 'RnB', 'Rhythm and Blues', 'Soul', 'Funk', 'Disco', 'Rhythmic Soul',
    'Neo-Soul', 'Motown',
    '소울', '알앤비'],
  electronic: ['Electronic', 'Electronica', 'Techno', 'Trance', 'House', 'Dance', 'EDM',
    'Dubstep', 'Drum & Bass', 'DnB', 'Ambient', 'Club', 'Rave', 'Eurodance', 'IDM',
    'Downtempo', 'Chillout', 'Chill', 'Electro', 'Breakbeat', 'Big Beat', 'Deep House',
    'Euro-Techno', 'Acid', 'Acid House', 'Goa', 'Psytrance', 'Synthwave',
    '일렉트로닉', '댄스', '테크노', '하우스', '트랜스'],
  jazz: ['Jazz', 'Acid Jazz', 'Jazz & Funk', 'Jazz-Funk', 'Fusion', 'Swing', 'Bebop',
    'Big Band', 'Lounge', 'Smooth Jazz', 'Bossa Nova',
    '재즈', '스윙'],
  blues: ['Blues', 'Delta Blues', 'Rhythm Blues',
    '블루스'],
  classical: ['Classical', 'Opera', 'Symphony', 'Sonata', 'Chamber Music', 'Chamber',
    'Baroque', 'Neoclassical', 'Instrumental', 'Orchestral',
    '클래식', '클래시컬', '오페라', '교향곡', '관현악'],
  country: ['Country', 'Bluegrass', 'Folk', 'National Folk', 'Americana', 'Celtic', 'Trot',
    '컨트리', '포크', '블루그래스', '트로트'],
  reggae: ['Reggae', 'Ska', 'Dancehall', 'Dub', 'Roots',
    '레게', '스카'],
  latin: ['Latin', 'Salsa', 'Samba', 'Tango', 'Merengue', 'Mambo', 'Flamenco', 'Bachata',
    'Cumbia',
    '라틴', '살사', '삼바', '탱고'],
  soundtrack: ['Soundtrack', 'OST', 'Score', 'Film Score', 'Musical', 'Showtunes', 'Showtune',
    'Trailer',
    '사운드트랙', '오에스티', '뮤지컬', '영화음악'],
  anime: ['Anime', 'Anison', 'Anime Song', 'J-Anime',
    '애니', '애니메이션', '아니메'],
  game: ['Game', 'Game Music', 'Video Game', 'Chiptune', '8-bit', 'Game OST',
    '게임', '게임음악'],
  christian: ['Contemporary Christian', 'CCM', 'Christian', 'Christian Rock', 'Christian Rap',
    'Gospel', 'Worship', 'Praise', 'Hymn', 'Spiritual',
    '찬양', '복음성가', '기독교', '워십'],
  christmas: ['Carol', 'Christmas', 'Christmas Carol', 'Holiday', 'Xmas',
    '캐롤', '캐럴', '크리스마스', '성탄', '성탄절'],
  acappella: ['A Cappella', 'Acappella', 'Barbershop', 'Doo-Wop',
    '아카펠라'],
  vocal: ['Vocal', 'Acoustic', 'Easy Listening', 'Chanson', 'Ballad', 'Power Ballad', 'Vocal Jazz',
    'Crooner',
    '발라드', '보컬', '어쿠스틱'],
  newage: ['New Age', 'Meditative', 'Meditation', 'Relaxation',
    '뉴에이지', '명상'],
  world: ['World', 'World Music', 'Ethnic', 'Folklore', 'Bhangra', 'Afrobeat',
    '월드뮤직', '월드', '국악', '민요', '전통음악'],
  kids: ['Kids', 'Children', "Children's", 'Nursery', 'Lullaby',
    '동요', '어린이'],
  spoken: ['Speech', 'Spoken Word', 'Audiobook', 'Podcast', 'Comedy', 'Audio Theatre', 'Stand-up',
    '오디오북', '팟캐스트'],
};

const norm = (s) => (s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

const ALIASES = {};
for (const [bucket, names] of Object.entries(BUCKETS)) {
  for (const name of names) ALIASES[norm(name)] = bucket;
}

export function bucketForGenre(name) {
  return ALIASES[norm(name)] || 'fallback';
}
