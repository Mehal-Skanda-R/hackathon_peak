// The Golden Heart: story text for the campaign. Data only, no game logic.
//
// Blackmere Castle keeps the Midnight Collection. Its Warden's family built
// the security to listen for heartbeats, because the collection's centrepiece,
// the Golden Heart, is the still-beating heart of Aurel, the castle's first
// guardian, cut from her shrine in the catacombs. Wren is the thief's handler
// on the radio; Vesper is a rival thief in a red cloak.

export const CHARACTERS = Object.freeze({
  wren: Object.freeze({ name: 'WREN', role: 'your handler', color: '#59dce6' }),
  warden: Object.freeze({ name: 'THE WARDEN', role: 'keeper of the collection', color: '#ff7a6b' }),
  vesper: Object.freeze({ name: 'VESPER', role: 'rival thief', color: '#ff5d6c' }),
});

// Radio lines per level id: `start` plays once the floor's preview ends,
// `door` as the thief goes through the exit (before the heist report).
export const FLOOR_LINES = Object.freeze({
  gallery: { start: "You're in. The guards here don't watch, they listen. Every beat you make, they hear.", door: 'Good. Six floors to go, and the Heart is at the top.' },
  'west-wing': { start: "West Wing. One of the old watchmen sleeps at his post. Two beats near him and he's up.", door: "West Wing done. Next, the Gallery Hall." },
  'gallery-hall': { start: "Careful. Someone else is in the Gallery Hall. Red cloak. That's Vesper, and she's after the same coins.", door: "Vesper's gone ahead. She doesn't know about the Heart. Keep it that way." },
  archive: { start: 'The Archive has hounds: guards that hear twice as far. Give them a wide berth.', door: 'Through the stacks. Nicely done.' },
  'vault-ring': { start: "Lantern-bearers on the outer ring. If you step into their light, they see you. Stay out of it. And Vesper's back.", door: 'The Vault Ring is behind you. Two floors left.' },
  'royal-exhibit': { start: 'The Royal Exhibit. A sleeper by the north wall, a lantern by the south. Pick your moment.', door: "Next floor is the top. The Warden's office is there. Don't wake him." },
  'final-heist': { start: "The Pinnacle. The Heart is in a case by the exit, behind a lock that only opens for a living heart. Coins open the door. The Heart is your choice.", door: "You're out. Breathe." },
  'bone-stair': { start: "The Bone Stair. No lamps down here, and your light won't reach as far. The Heart is pulling you down.", door: 'Deeper. The Heart is beating faster.' },
  ossuary: { start: 'The Ossuary. Vesper followed you down. Hounds and lanterns ahead.', door: 'One more depth. The shrine is close.' },
  'heart-shrine': { start: "Aurel's shrine. The Warden followed you. He'll hunt every beat. Get the Heart onto the shrine.", door: 'You did it. Come home.' },
});

// Moments during play, spoken by Wren unless `who` says otherwise.
export const MOMENTS = Object.freeze({
  heartLockNear: { text: 'That\'s the Heart Lock. Raise your heart rate, then let it settle. Or pick it slowly: the hard way works too.' },
  heartLockArmed: { text: "It felt that. Now calm down. Let it settle." },
  heartTaken: { who: 'warden', text: 'Who is there? I hear you. I hear IT.' },
  doorSealed: { text: 'The door just sealed. The Warden is coming. Hide in the rugs and keep your heart down until he gives up.' },
  inspectionStart: { who: 'warden', text: 'Still. Very still. Let me listen.' },
  inspectionPassed: { text: "He's walking away. The door's open. Go. Now." },
  wardenHunting: { who: 'warden', text: 'Every heartbeat. I hear every one.' },
  shrinePlaced: { who: 'warden', text: '...It is quiet. For the first time in sixty years, it is quiet.' },
  vesperArrives: { who: 'vesper', text: 'Oh, look. The little pulse. Try to keep up.' },
  vesperCoin: { who: 'vesper', text: "Mine. You're too slow." },
  vesperLeaves: { who: 'vesper', text: "That's my share. See you at the top." },
  journal: { text: 'A page from the Warden\'s journal. Keep it.' },
});

// One journal page per floor, hidden on a floor cell and visible only in
// pulse light. The cells are checked by tests/engine/geometry.test.js.
export const JOURNAL = Object.freeze([
  { level: 'gallery', cell: [10, 10], title: 'The Night Watch',
    text: 'Grandfather built the watch to listen, not to look. "Lamps can be shuttered," he said. "A heart cannot."' },
  { level: 'west-wing', cell: [13, 8], title: 'Old Bram',
    text: 'Old Bram sleeps at his post again. I let him. Two beats near his chair and he is awake before the third.' },
  { level: 'gallery-hall', cell: [12, 11], title: 'The Red Cloak',
    text: 'A woman in a red cloak reached the Gallery Hall tonight. Vesper, the constable says. She took the coins and left my guards chasing her noise. She will be back.' },
  { level: 'archive', cell: [14, 9], title: 'Hounds',
    text: 'The new watch hears twice as far as the old. The men call them hounds. Mother would have hated it.' },
  { level: 'vault-ring', cell: [12, 8], title: 'Lanterns',
    text: 'My eyes are failing. I gave the outer watch lanterns, so that someone in this castle can still see.' },
  { level: 'royal-exhibit', cell: [14, 14], title: 'What the Heart Is',
    text: 'It is not a jewel. Grandfather cut it from the shrine beneath the castle: the heart of Aurel, the first guardian. It still beats. I hear it through the floors at night.' },
  { level: 'final-heist', cell: [12, 8], title: 'The Lock',
    text: 'I sealed the case so that only a living heart can open it. Race, then rest. No machine can do both.' },
  { level: 'bone-stair', cell: [6, 8], title: 'Below',
    text: 'The stair to the catacombs was bricked up before I was born. If the Heart ever leaves the vault, I think it will want to go home.' },
  { level: 'ossuary', cell: [12, 9], title: 'The Echoes',
    text: 'The museum remembers every thief it catches. After hours I hear their footsteps in the galleries, walking the routes that failed them.' },
  { level: 'heart-shrine', cell: [4, 7], title: "Aurel's Promise",
    text: 'The inscription on the shrine reads: "While my heart rests here, the valley is watched over. Take it, and the watchers will never sleep." We took it. None of us has slept since.' },
]);

export const journalFor = levelId => JOURNAL.find(page => page.level === levelId) ?? null;

// Endings, in the order they are listed in the Archive.
export const ENDINGS = Object.freeze({
  clean: Object.freeze({ title: 'The Clean Thief', note: 'Escape floor 07 without the Golden Heart.' }),
  heart: Object.freeze({ title: 'The Heart Taken', note: 'Escape floor 07 with the Golden Heart. Unlocks Act III.' }),
  returned: Object.freeze({ title: 'The Heart Returned', note: "Place the Heart on Aurel's shrine and escape." }),
  last: Object.freeze({ title: 'The Last Watch', note: 'The true ending: return the Heart with all ten journal pages found.' }),
});

// Cutscene cards. Each card is one code-drawn panel (src/story/cards.js) plus text.
export const CUTSCENES = Object.freeze({
  intro: [
    { panel: 'castle', eyebrow: 'OPERATION 001 · THE MUSEUM JOB', title: 'Blackmere Castle',
      text: 'Seven floors of the Midnight Collection. At the very top, in a case no thief has opened, the Golden Heart.' },
    { panel: 'radio', eyebrow: 'WREN · YOUR HANDLER', title: 'They listen.',
      text: "The guards here don't use their eyes. Every beat of your heart lights the halls for you, and tells them where you are. Keep your head. Keep your heart. I'll be on the radio." },
  ],
  heart: [
    { panel: 'heart', eyebrow: 'ENDING · THE HEART TAKEN', title: 'It beats with you.',
      text: 'The Golden Heart beats in your bag, in time with your own. Behind you the Warden kneels by the empty case. "Something\'s wrong," says Wren. "The castle is louder, not quieter."' },
    { panel: 'stair', eyebrow: 'ACT III UNLOCKED · THE CATACOMBS', title: 'The Heart wants to go home.',
      text: 'Far below the vault, a bricked-up stair has cracked open. Find it from the castle screen.' },
  ],
  clean: [
    { panel: 'moon', eyebrow: 'ENDING · THE CLEAN THIEF', title: 'Rich, alive, uncursed.',
      text: 'You leave the Heart where it beats and slip out with the coins. "Nobody\'s cursed and nobody\'s chasing us," says Wren. "I\'ll take it." The Heart Lock is still there, if you ever go back.' },
  ],
  act3: [
    { panel: 'stair', eyebrow: 'OPERATION 002 · THE CATACOMBS', title: 'Down the Bone Stair',
      text: "The Heart pulls downward, toward the stair the Warden's family bricked up. \"No lamps down there,\" says Wren. \"Just you, the dark and that thing beating in your bag.\" Carry the Heart to Aurel's shrine." },
  ],
  returned: [
    { panel: 'shrine', eyebrow: 'ENDING · THE HEART RETURNED', title: 'Quiet.',
      text: 'You set the Heart on the shrine. It beats once, loud as a bell, and goes still. Above you, every guard in Blackmere sits down and closes their eyes. The Warden says only: "Thank you."' },
  ],
  last: [
    { panel: 'dawn', eyebrow: 'THE TRUE ENDING · THE LAST WATCH', title: 'The watchers sleep.',
      text: 'You read Aurel\'s promise to the Warden, from his own journal. He laughs, then cries, then opens the castle gates for the first time in sixty years. "So," says Wren. "Same time next year?"' },
  ],
});
